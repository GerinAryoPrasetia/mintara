import { create } from 'zustand'
import type { ExportedMock, MockImportResult, MockResponse, MockRule, MockSlug, RecordedRequest } from '@mintara/shared'
import * as api from './api'

const LOG_CAP = 500

// Module-level so selecting another slug can close the previous stream
let closeStream: (() => void) | null = null

interface MockWebhookStore {
  mocks: MockSlug[]
  port: number
  selectedSlug: string | null
  requests: RecordedRequest[]
  selectedRequestId: string | null
  error: string | null

  init: () => Promise<void>
  select: (slug: string | null) => Promise<void>
  create: (slug: string) => Promise<boolean>
  /** Creates new slugs; existing ones are overwritten or skipped per `resolutions`. */
  importMocks: (mocks: ExportedMock[], resolutions: Record<string, 'overwrite' | 'skip'>) => Promise<MockImportResult | null>
  rename: (slug: string, newSlug: string) => Promise<string | null>
  remove: (slug: string) => Promise<void>
  save: (slug: string, patch: { rules: MockRule[]; defaultResponse: MockResponse }) => Promise<boolean>
  selectRequest: (id: string | null) => void
  clearLog: () => Promise<void>
  clearAllLogs: () => Promise<void>
  setError: (error: string | null) => void
}

export const useMockWebhookStore = create<MockWebhookStore>()((set, get) => {
  const replaceMock = (mock: MockSlug, oldSlug = mock.slug) =>
    set((s) => ({
      mocks: [...s.mocks.filter((m) => m.slug !== oldSlug && m.slug !== mock.slug), mock].sort((a, b) =>
        a.slug.localeCompare(b.slug),
      ),
    }))

  const guard = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      const out = await fn()
      set({ error: null })
      return out
    } catch (err) {
      set({ error: api.errorMessage(err) })
      return undefined
    }
  }

  return {
    mocks: [],
    port: 3001,
    selectedSlug: null,
    requests: [],
    selectedRequestId: null,
    error: null,

    init: async () => {
      await guard(async () => {
        const [info, mocks] = await Promise.all([api.getInfo(), api.listMocks()])
        set({ port: info.port, mocks })
        const current = get().selectedSlug
        if (current && mocks.some((m) => m.slug === current)) await get().select(current)
        else if (mocks[0]) await get().select(mocks[0].slug)
      })
    },

    select: async (slug) => {
      closeStream?.()
      closeStream = null
      set({ selectedSlug: slug, requests: [], selectedRequestId: null })
      if (!slug) return
      closeStream = api.openStream(
        slug,
        (r) => {
          if (get().selectedSlug !== slug) return
          set((s) => ({ requests: [r, ...s.requests.filter((x) => x.id !== r.id)].slice(0, LOG_CAP) }))
        },
        () => {
          if (get().selectedSlug === slug) set({ requests: [], selectedRequestId: null })
        },
      )
      const requests = await guard(() => api.listRequests(slug))
      // Merge: anything the stream delivered while the list was loading stays on top
      if (requests && get().selectedSlug === slug) {
        set((s) => {
          const seen = new Set(s.requests.map((r) => r.id))
          return { requests: [...s.requests, ...requests.filter((r) => !seen.has(r.id))].slice(0, LOG_CAP) }
        })
      }
    },

    create: async (slug) => {
      const mock = await guard(() => api.createMock(slug))
      if (!mock) return false
      replaceMock(mock)
      await get().select(mock.slug)
      return true
    },

    importMocks: async (mocks, resolutions) => {
      const result = await guard(() => api.importMocks({ mocks, resolutions }))
      if (!result) return null
      const fresh = await guard(() => api.listMocks())
      if (fresh) set({ mocks: fresh })
      const current = get().selectedSlug
      const first = result.created[0] ?? result.overwritten[0]
      if (!current && first) await get().select(first)
      return result
    },

    rename: async (slug, newSlug) => {
      try {
        const mock = await api.renameMock(slug, newSlug)
        replaceMock(mock, slug)
        if (get().selectedSlug === slug) await get().select(mock.slug)
        set({ error: null })
        return null
      } catch (err) {
        return api.errorMessage(err)
      }
    },

    remove: async (slug) => {
      const ok = await guard(async () => {
        await api.deleteMock(slug)
        return true
      })
      if (!ok) return
      const mocks = get().mocks.filter((m) => m.slug !== slug)
      set({ mocks })
      if (get().selectedSlug === slug) await get().select(mocks[0]?.slug ?? null)
    },

    save: async (slug, patch) => {
      const mock = await guard(() => api.updateMock(slug, patch))
      if (!mock) return false
      replaceMock(mock)
      return true
    },

    selectRequest: (id) => set({ selectedRequestId: id }),

    clearLog: async () => {
      const slug = get().selectedSlug
      if (!slug) return
      await guard(() => api.clearRequests(slug))
      set({ requests: [], selectedRequestId: null })
    },

    clearAllLogs: async () => {
      await guard(() => api.clearAllRequests())
      set({ requests: [], selectedRequestId: null })
    },

    setError: (error) => set({ error }),
  }
})
