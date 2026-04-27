import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CompareRequest, CompareResult, BulkRequestItem, BulkItemResult } from '@mintara/shared'
import { runCompareRequest } from './lib/api'

export interface SavedCase {
  name: string
  mode: 'single' | 'bulk'
  config: CompareRequest
  // bulk-specific (only present when mode === 'bulk')
  bulkItems?: BulkRequestItem[]
  bulkSharedHeaders?: Record<string, string>
  usePerRequestHeaders?: boolean
}

export interface SavedCasesExport {
  version: 1
  exportedAt: string
  cases: SavedCase[]
}

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
  saveCase: (name: string) => void
  loadCase: (name: string) => void
  deleteCase: (name: string) => void
  importCases: (incoming: SavedCase[], resolutions: Record<string, 'overwrite' | 'skip'>) => void

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

// Module-level stop flag so stopBulk() can signal the running loop
let stopFlag = { value: false }

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      request: DEFAULT_REQUEST,
      result: null,
      isLoading: false,
      error: null,
      savedCases: [],

      setRequest: (patch) =>
        set((state) => ({ request: { ...state.request, ...patch } })),

      runCompare: async () => {
        set({ isLoading: true, error: null, result: null })
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

      saveCase: (name) => {
        const { request, mode, bulkItems, bulkSharedHeaders, usePerRequestHeaders, savedCases } = get()
        const filtered = savedCases.filter((c) => c.name !== name)
        const entry: SavedCase =
          mode === 'bulk'
            ? { name, mode, config: { ...request }, bulkItems: [...bulkItems], bulkSharedHeaders: { ...bulkSharedHeaders }, usePerRequestHeaders }
            : { name, mode: 'single', config: { ...request } }
        set({ savedCases: [...filtered, entry] })
      },

      loadCase: (name) => {
        const found = get().savedCases.find((c) => c.name === name)
        if (!found) return
        if (found.mode === 'bulk') {
          set({
            mode: 'bulk',
            request: { ...found.config },
            bulkItems: found.bulkItems ? [...found.bulkItems] : [],
            bulkSharedHeaders: found.bulkSharedHeaders ? { ...found.bulkSharedHeaders } : {},
            usePerRequestHeaders: found.usePerRequestHeaders ?? false,
            result: null,
          })
        } else {
          set({ mode: 'single', request: { ...found.config }, result: null })
        }
      },

      deleteCase: (name) => {
        set((state) => ({
          savedCases: state.savedCases.filter((c) => c.name !== name),
        }))
      },

      importCases: (incoming, resolutions) => {
        set((state) => {
          const result = [...state.savedCases]
          for (const c of incoming) {
            const idx = result.findIndex((e) => e.name === c.name)
            if (idx === -1) {
              result.push(c)
            } else if (resolutions[c.name] === 'overwrite') {
              result[idx] = c
            }
            // 'skip' or no resolution entry → leave existing untouched
          }
          return { savedCases: result }
        })
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

          // Build the compare request using the new CompareRequest shape
          // (path + per-target baseUrl/headers; bulk headers merged on top of target headers)
          const extraHeaders = usePerRequestHeaders ? (item.headers ?? {}) : bulkSharedHeaders
          const compareReq: CompareRequest = {
            method: item.method,
            path: item.path,
            body: item.body,
            targets: request.targets.map((target) => ({
              ...target,
              headers: { ...target.headers, ...extraHeaders },
            })),
            normalization: item.normalization ?? request.normalization,
          }

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

        const extraHeaders = usePerRequestHeaders ? (item.headers ?? {}) : bulkSharedHeaders
        const compareReq: CompareRequest = {
          method: item.method,
          path: item.path,
          body: item.body,
          targets: request.targets.map((target) => ({
            ...target,
            headers: { ...target.headers, ...extraHeaders },
          })),
          normalization: item.normalization ?? request.normalization,
        }

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
      partialize: (state) => ({ savedCases: state.savedCases }),
    },
  ),
)
