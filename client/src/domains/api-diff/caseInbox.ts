import { useEffect, useRef } from 'react'
import type { ExportedCase } from './testCases'

/**
 * Pick-up side of the server's case inbox (POST /api/cases/inbox): exports
 * pushed by scripts are imported by whichever tab claims them first.
 */
export interface CaseInboxEntry {
  id: string
  receivedAt: string
  source: string | null
  caseNames: string[]
  export: { version: 1 | 2; exportedAt: string; cases: ExportedCase[] }
}

type FetchLike = (input: string, init?: { method?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

/**
 * Claims the oldest pending entry: DELETE first, so with several tabs open
 * only the one whose DELETE succeeds imports it. Returns null when empty.
 */
export async function claimNextInboxEntry(fetchImpl: FetchLike = fetch): Promise<CaseInboxEntry | null> {
  const res = await fetchImpl('/api/cases/inbox')
  if (!res.ok) return null
  const entries = (await res.json()) as CaseInboxEntry[]
  for (const entry of entries) {
    const del = await fetchImpl(`/api/cases/inbox/${encodeURIComponent(entry.id)}`, { method: 'DELETE' })
    if (del.status === 204) return entry
    // 404: another tab claimed it first — try the next one
  }
  return null
}

const POLL_MS = 3000

/** Polls while mounted (and on window focus); paused while an import dialog is open. */
export function useCaseInbox(onEntry: (entry: CaseInboxEntry) => void, paused: boolean) {
  const onEntryRef = useRef(onEntry)
  onEntryRef.current = onEntry
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    let busy = false
    const tick = async () => {
      if (busy || pausedRef.current) return
      busy = true
      try {
        const entry = await claimNextInboxEntry()
        if (entry) onEntryRef.current(entry)
      } catch {
        // server down or restarting — try again on the next tick
      } finally {
        busy = false
      }
    }
    void tick()
    const timer = setInterval(() => void tick(), POLL_MS)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', tick)
    }
  }, [])
}
