import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CompareRequest, CompareResult, BulkRequestItem, BulkItemResult } from '@mintara/shared'
import { runCompareRequest } from './api'
import { summarizeSingle, summarizeBulkItem, summarizeBulkAggregate } from './summarize'
import { diffTargets } from './diff'
import { buildBulkCompareRequest } from './bulkRequest'
import * as testCases from './testCases'
import type { SavedCase, WorkingCase } from './testCases'

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
  importCases: (incoming: SavedCase[], resolutions: Record<string, 'overwrite' | 'skip'>) => void
  switchCase: (name: string) => void
  newCase: () => void
  duplicateCase: (name: string) => void
  saveCurrentCase: (name?: string) => void

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

const DEFAULT_REQUEST: CompareRequest = {
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
        set({ savedCases: cases, activeCaseName })
      },

      loadCase: (name) => {
        const loaded = testCases.loadCase(get().savedCases, name)
        if (!loaded) return
        set({ ...loaded, result: null, activeCaseName: name })
      },

      deleteCase: (name) => {
        const state = get()
        set(testCases.deleteCase(state.savedCases, state.activeCaseName, name))
      },

      switchCase: (name) => {
        const state = get()
        const result = testCases.switchCase(state.savedCases, state.activeCaseName, currentWorking(state), name)
        set({
          savedCases: result.cases,
          activeCaseName: result.activeCaseName,
          ...(result.toLoad ? { ...result.toLoad, result: null } : {}),
        })
      },

      newCase: () => {
        const state = get()
        const result = testCases.newCase(state.savedCases, state.activeCaseName, currentWorking(state))
        set({
          savedCases: result.cases,
          activeCaseName: result.activeCaseName,
          request: { ...DEFAULT_REQUEST },
          mode: 'single',
          bulkItems: [],
          bulkSharedHeaders: {},
          usePerRequestHeaders: false,
          result: null,
        })
      },

      duplicateCase: (name) => {
        set((state) => ({ savedCases: testCases.duplicateCase(state.savedCases, name) }))
      },

      saveCurrentCase: (name) => {
        const state = get()
        set(testCases.saveCurrentCase(state.savedCases, state.activeCaseName, currentWorking(state), name))
      },

      importCases: (incoming, resolutions) => {
        set((state) => ({ savedCases: testCases.importCases(state.savedCases, incoming, resolutions) }))
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
    },
  ),
)
