import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CompareRequest, CompareResult, BulkRequestItem, BulkItemResult } from '@mintara/shared'
import { runCompareRequest } from './api'
import { summarizeSingle, summarizeBulkItem, summarizeBulkAggregate } from './summarize'
import { diffTargets } from './diff'
import { buildBulkCompareRequest } from './bulkRequest'
import * as testCases from './testCases'
import type { SavedCase, ExportedCase, WorkingCase } from './testCases'
import * as caseResults from './caseResults'
import type { CaseResults, CaseResultsCache } from './caseResults'

interface AppStore {
  // Current request configuration
  request: CompareRequest
  setRequest: (patch: Partial<CompareRequest>) => void

  // Results
  result: CompareResult | null
  isLoading: boolean
  error: string | null
  runCompare: () => Promise<void>

  // Persisted test cases
  savedCases: SavedCase[]
  activeCaseName: string | null
  saveCase: (name: string) => void
  loadCase: (name: string) => void
  deleteCase: (name: string) => void
  importCases: (incoming: ExportedCase[], resolutions: Record<string, 'overwrite' | 'skip'>) => void
  switchCase: (name: string) => void
  newCase: () => void
  duplicateCase: (name: string) => void
  /** Returns an error message, or null when the rename succeeded. */
  renameCase: (oldName: string, newName: string) => string | null
  saveCurrentCase: (name?: string) => void
  /**
   * Only `savedCases` + `activeCaseName` survive a reload — the working state
   * does not. Without this, the sidebar would show a case as active while the
   * working state sat empty, and the next auto-save would overwrite that case
   * with the empty state. Called on rehydration to put the two back in sync.
   */
  rehydrateActiveCase: () => void

  /**
   * Results held per case name so switching cases shows that case's own run.
   * Session-only — deliberately outside `partialize` (response bodies would
   * blow the localStorage quota).
   */
  caseResults: CaseResultsCache
  /** The results to export for a case: live state if it's active, else the cache. */
  resultsForCase: (name: string) => CaseResults

  // AI summaries (session-only)
  singleSummary: string | null
  singleSummaryLoading: boolean
  bulkItemSummaries: Record<string, string>
  bulkItemSummaryLoading: Record<string, boolean>
  bulkAggregateSummary: string | null
  bulkAggregateSummaryLoading: boolean
  generateSingleSummary: () => Promise<void>
  generateBulkItemSummary: (itemId: string) => Promise<void>
  generateAllBulkItemSummaries: () => Promise<void>
  generateBulkAggregateSummary: () => Promise<void>

  // Mode
  mode: 'single' | 'bulk'
  setMode: (mode: 'single' | 'bulk') => void

  // Bulk state
  bulkItems: BulkRequestItem[]
  setBulkItems: (items: BulkRequestItem[]) => void

  bulkSharedHeaders: Record<string, string>
  setBulkSharedHeaders: (h: Record<string, string>) => void

  usePerRequestHeaders: boolean
  setUsePerRequestHeaders: (v: boolean) => void

  bulkResults: BulkItemResult[]
  bulkProgress: { current: number; total: number } | null
  isBulkRunning: boolean

  stopBulk: () => void
  runBulk: () => Promise<void>
  retryBulkItem: (itemId: string) => Promise<void>
}

export const DEFAULT_REQUEST: CompareRequest = {
  method: 'GET',
  path: '',
  body: undefined,
  targets: [
    { name: 'PHP 5', baseUrl: '', headers: {} },
    { name: 'PHP 8', baseUrl: '', headers: {} },
  ],
  normalization: {
    ignoreFields: [],
    sortArrays: false,
  },
}

function liveResults(state: AppStore): CaseResults {
  return {
    result: state.result,
    bulkResults: state.bulkResults,
    singleSummary: state.singleSummary,
    bulkItemSummaries: state.bulkItemSummaries,
    bulkAggregateSummary: state.bulkAggregateSummary,
  }
}

/**
 * Saving under a different name moves the on-screen results to that name, so
 * park a copy under the case we're leaving rather than losing its results.
 */
function stashOnRename(state: AppStore, nextActiveName: string | null): CaseResultsCache {
  if (state.activeCaseName === null || state.activeCaseName === nextActiveName) return state.caseResults
  return caseResults.stashResults(state.caseResults, state.activeCaseName, liveResults(state))
}

function currentWorking(state: AppStore): WorkingCase {
  return {
    mode: state.mode,
    request: state.request,
    bulkItems: state.bulkItems,
    bulkSharedHeaders: state.bulkSharedHeaders,
    usePerRequestHeaders: state.usePerRequestHeaders,
  }
}

// Module-level stop flag so stopBulk() can signal the running loop
let stopFlag = { value: false }

export const useApiDiffStore = create<AppStore>()(
  persist(
    (set, get) => ({
      request: DEFAULT_REQUEST,
      result: null,
      isLoading: false,
      error: null,
      savedCases: [],
      activeCaseName: null,
      caseResults: {},

      setRequest: (patch) =>
        set((state) => ({ request: { ...state.request, ...patch } })),

      runCompare: async () => {
        set({ isLoading: true, error: null, result: null, singleSummary: null })
        try {
          const result = await runCompareRequest(get().request)
          set({ result, isLoading: false })
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      },

      // AI summaries
      singleSummary: null,
      singleSummaryLoading: false,
      bulkItemSummaries: {},
      bulkItemSummaryLoading: {},
      bulkAggregateSummary: null,
      bulkAggregateSummaryLoading: false,

      generateSingleSummary: async () => {
        const { result, request } = get()
        if (!result || result.targets.length < 2) return
        set({ singleSummaryLoading: true })
        const diffs = diffTargets(result.targets[0].body, result.targets[1].body, request.normalization)
        try {
          const summary = await summarizeSingle(request.method, request.path, result.targets, diffs, result.hasChanges)
          set({ singleSummary: summary, singleSummaryLoading: false })
        } catch {
          set({ singleSummaryLoading: false })
        }
      },

      generateBulkItemSummary: async (itemId: string) => {
        const { bulkResults, request } = get()
        const entry = bulkResults.find((r) => r.item.id === itemId)
        if (!entry?.result || entry.result.targets.length < 2) return
        set((state) => ({
          bulkItemSummaryLoading: { ...state.bulkItemSummaryLoading, [itemId]: true },
        }))
        const { targets } = entry.result
        const diffs = diffTargets(targets[0].body, targets[1].body, entry.item.normalization ?? request.normalization)
        try {
          const summary = await summarizeBulkItem(
            entry.item.method,
            entry.item.path,
            targets,
            diffs,
            entry.result.hasChanges,
          )
          set((state) => ({
            bulkItemSummaries: { ...state.bulkItemSummaries, [itemId]: summary },
            bulkItemSummaryLoading: { ...state.bulkItemSummaryLoading, [itemId]: false },
          }))
        } catch {
          set((state) => ({
            bulkItemSummaryLoading: { ...state.bulkItemSummaryLoading, [itemId]: false },
          }))
        }
      },

      generateAllBulkItemSummaries: async () => {
        const { bulkResults, generateBulkItemSummary } = get()
        const doneIds = bulkResults
          .filter((r) => r.status === 'done' && r.result)
          .map((r) => r.item.id)
        await Promise.all(doneIds.map((id) => generateBulkItemSummary(id)))
      },

      generateBulkAggregateSummary: async () => {
        const { bulkResults, request } = get()
        set({ bulkAggregateSummaryLoading: true })
        const doneResults = bulkResults.filter((r) => r.status === 'done' && r.result)
        const totalItems = bulkResults.length
        const passedItems = doneResults.filter((r) => !r.result!.hasChanges).length
        const failedItems = doneResults.filter((r) => r.result!.hasChanges).length
        const pathCounts: Record<string, number> = {}
        for (const entry of doneResults) {
          if (!entry.result || entry.result.targets.length < 2) continue
          const { targets } = entry.result
          const nodes = diffTargets(targets[0].body, targets[1].body, entry.item.normalization ?? request.normalization)
          for (const node of nodes) {
            if (node.status !== 'equal') {
              pathCounts[node.path] = (pathCounts[node.path] ?? 0) + 1
            }
          }
        }
        const commonDiffPaths = Object.entries(pathCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([path]) => path)
        try {
          const summary = await summarizeBulkAggregate(totalItems, passedItems, failedItems, commonDiffPaths)
          set({ bulkAggregateSummary: summary, bulkAggregateSummaryLoading: false })
        } catch {
          set({ bulkAggregateSummaryLoading: false })
        }
      },

      saveCase: (name) => {
        const state = get()
        const { cases, activeCaseName } = testCases.saveCase(state.savedCases, name, currentWorking(state))
        set({ savedCases: cases, activeCaseName, caseResults: stashOnRename(state, activeCaseName) })
      },

      loadCase: (name) => {
        const state = get()
        const loaded = testCases.loadCase(state.savedCases, name)
        if (!loaded) return
        const cache = caseResults.stashResults(state.caseResults, state.activeCaseName, liveResults(state))
        set({
          ...loaded,
          activeCaseName: name,
          caseResults: cache,
          ...caseResults.restoreResults(cache, name),
        })
      },

      deleteCase: (name) => {
        const state = get()
        const { cases, activeCaseName } = testCases.deleteCase(state.savedCases, state.activeCaseName, name)
        set({
          savedCases: cases,
          activeCaseName,
          caseResults: caseResults.dropResults(state.caseResults, name),
        })
      },

      switchCase: (name) => {
        const state = get()
        const result = testCases.switchCase(state.savedCases, state.activeCaseName, currentWorking(state), name)
        if (!result.toLoad) {
          set({ savedCases: result.cases, activeCaseName: result.activeCaseName })
          return
        }
        const cache = caseResults.stashResults(state.caseResults, state.activeCaseName, liveResults(state))
        set({
          savedCases: result.cases,
          activeCaseName: result.activeCaseName,
          caseResults: cache,
          ...result.toLoad,
          ...caseResults.restoreResults(cache, name),
        })
      },

      newCase: () => {
        const state = get()
        const result = testCases.newCase(state.savedCases, state.activeCaseName, currentWorking(state))
        set({
          savedCases: result.cases,
          activeCaseName: result.activeCaseName,
          caseResults: caseResults.stashResults(state.caseResults, state.activeCaseName, liveResults(state)),
          request: { ...DEFAULT_REQUEST },
          mode: 'single',
          bulkItems: [],
          bulkSharedHeaders: {},
          usePerRequestHeaders: false,
          ...caseResults.EMPTY_CASE_RESULTS,
        })
      },

      duplicateCase: (name) => {
        set((state) => {
          const cases = testCases.duplicateCase(state.savedCases, name)
          const copy = cases.find((c) => !state.savedCases.includes(c))
          return {
            savedCases: cases,
            caseResults: copy ? caseResults.copyResults(state.caseResults, name, copy.name) : state.caseResults,
          }
        })
      },

      renameCase: (oldName, newName) => {
        const state = get()
        const res = testCases.renameCase(state.savedCases, state.activeCaseName, oldName, newName)
        if (!res.ok) return res.error
        const renamed = res.cases.find((c) => !state.savedCases.includes(c))
        set({
          savedCases: res.cases,
          activeCaseName: res.activeCaseName,
          caseResults: renamed ? caseResults.moveResults(state.caseResults, oldName, renamed.name) : state.caseResults,
        })
        return null
      },

      rehydrateActiveCase: () => {
        const state = get()
        if (state.activeCaseName === null) return
        const loaded = testCases.loadCase(state.savedCases, state.activeCaseName)
        // Active case no longer exists (deleted in another tab): drop the pointer
        // rather than leave it aimed at nothing.
        if (!loaded) {
          set({ activeCaseName: null })
          return
        }
        set({ ...loaded, ...caseResults.EMPTY_CASE_RESULTS })
      },

      saveCurrentCase: (name) => {
        const state = get()
        const saved = testCases.saveCurrentCase(state.savedCases, state.activeCaseName, currentWorking(state), name)
        set({ ...saved, caseResults: stashOnRename(state, saved.activeCaseName) })
      },

      importCases: (incoming, resolutions) => {
        set((state) => {
          const split = testCases.splitImported(incoming)
          const savedCases = testCases.importCases(state.savedCases, split.cases, resolutions)
          // Only keep results for cases that actually landed — a 'skip' resolution
          // leaves the existing case in place, so its old results stay too.
          const accepted = Object.fromEntries(
            Object.entries(split.results).filter(([name]) => savedCases.some((c) => c.name === name) && resolutions[name] !== 'skip'),
          )
          return { savedCases, caseResults: { ...state.caseResults, ...accepted } }
        })
      },

      resultsForCase: (name) => {
        const state = get()
        if (state.activeCaseName === name) return liveResults(state)
        return caseResults.restoreResults(state.caseResults, name)
      },

      // Mode
      mode: 'single',
      setMode: (mode) => set({ mode }),

      // Bulk state
      bulkItems: [],
      setBulkItems: (items) => set({ bulkItems: items }),

      bulkSharedHeaders: {},
      setBulkSharedHeaders: (h) => set({ bulkSharedHeaders: h }),

      usePerRequestHeaders: false,
      setUsePerRequestHeaders: (v) => set({ usePerRequestHeaders: v }),

      bulkResults: [],
      bulkProgress: null,
      isBulkRunning: false,

      stopBulk: () => {
        stopFlag.value = true
      },

      runBulk: async () => {
        // Reset stop flag for this run
        stopFlag = { value: false }

        const { bulkItems, bulkSharedHeaders, usePerRequestHeaders, request } = get()

        set({
          isBulkRunning: true,
          bulkProgress: { current: 0, total: bulkItems.length },
          bulkResults: [],
          bulkItemSummaries: {},
          bulkItemSummaryLoading: {},
          bulkAggregateSummary: null,
        })

        for (let i = 0; i < bulkItems.length; i++) {
          if (stopFlag.value) break

          const item = bulkItems[i]

          // Mark item as running
          set((state) => {
            const results = [...state.bulkResults]
            results[i] = { item, result: null, error: null, status: 'running' }
            return { bulkResults: results, bulkProgress: { current: i + 1, total: bulkItems.length } }
          })

          const compareReq = buildBulkCompareRequest(item, request, bulkSharedHeaders, usePerRequestHeaders)

          try {
            const result = await runCompareRequest(compareReq)
            set((state) => {
              const results = [...state.bulkResults]
              results[i] = { item, result, error: null, status: 'done' }
              return { bulkResults: results }
            })
          } catch (err) {
            set((state) => {
              const results = [...state.bulkResults]
              results[i] = {
                item,
                result: null,
                error: err instanceof Error ? err.message : 'Unknown error',
                status: 'error',
              }
              return { bulkResults: results }
            })
          }
        }

        set({ isBulkRunning: false, bulkProgress: null })
      },

      retryBulkItem: async (itemId: string) => {
        const { bulkItems, bulkResults, bulkSharedHeaders, usePerRequestHeaders, request } = get()
        const idx = bulkResults.findIndex((r) => r.item.id === itemId)
        if (idx === -1) return
        // Use the current bulkItems entry so any edits made after the original run are picked up
        const item = bulkItems.find((i) => i.id === itemId) ?? bulkResults[idx].item

        set((state) => {
          const results = [...state.bulkResults]
          results[idx] = { item, result: null, error: null, status: 'running' }
          return { bulkResults: results }
        })

        const compareReq = buildBulkCompareRequest(item, request, bulkSharedHeaders, usePerRequestHeaders)

        try {
          const result = await runCompareRequest(compareReq)
          set((state) => {
            const results = [...state.bulkResults]
            results[idx] = { item, result, error: null, status: 'done' }
            return { bulkResults: results }
          })
        } catch (err) {
          set((state) => {
            const results = [...state.bulkResults]
            results[idx] = {
              item,
              result: null,
              error: err instanceof Error ? err.message : 'Unknown error',
              status: 'error',
            }
            return { bulkResults: results }
          })
        }
      },
    }),
    {
      name: 'mintara-storage',
      // Only persist savedCases — request and result are session-only
      partialize: (state) => ({ savedCases: state.savedCases, activeCaseName: state.activeCaseName }),
      onRehydrateStorage: () => (state) => state?.rehydrateActiveCase(),
    },
  ),
)
