import { EventEmitter } from 'events'
import type { RecordedRequest } from '@mintara/shared'

export const LOG_CAP_PER_SLUG = 500

export type LogEvent = { type: 'request'; request: RecordedRequest } | { type: 'cleared' }

/**
 * In-memory request log, newest first, capped per slug. Deliberately never
 * written to disk: it holds whatever the callers send (tokens, customer data).
 */
export function createRequestLog(cap = LOG_CAP_PER_SLUG) {
  const entries = new Map<string, RecordedRequest[]>()
  const events = new EventEmitter()
  events.setMaxListeners(0)

  const emit = (slug: string, event: LogEvent) => events.emit(slug, event)

  return {
    add(request: RecordedRequest) {
      const list = entries.get(request.slug) ?? []
      list.unshift(request)
      if (list.length > cap) list.length = cap
      entries.set(request.slug, list)
      emit(request.slug, { type: 'request', request })
    },
    list(slug: string, limit = cap): RecordedRequest[] {
      return (entries.get(slug) ?? []).slice(0, Math.max(0, limit))
    },
    clear(slug: string) {
      entries.delete(slug)
      emit(slug, { type: 'cleared' })
    },
    clearAll() {
      const slugs = [...entries.keys()]
      entries.clear()
      for (const slug of slugs) emit(slug, { type: 'cleared' })
    },
    rename(oldSlug: string, newSlug: string) {
      const list = entries.get(oldSlug)
      entries.delete(oldSlug)
      if (list) entries.set(newSlug, list.map((r) => ({ ...r, slug: newSlug })))
    },
    subscribe(slug: string, listener: (event: LogEvent) => void): () => void {
      events.on(slug, listener)
      return () => events.off(slug, listener)
    },
  }
}

export type RequestLog = ReturnType<typeof createRequestLog>
