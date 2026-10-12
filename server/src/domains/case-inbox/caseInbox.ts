import { randomUUID } from 'crypto'

/**
 * Test-case exports pushed from outside the browser (e.g. a fixture-builder
 * script) wait here until an open client picks them up and runs them through
 * its normal import flow. Saved cases live in the browser's localStorage, so
 * the server never stores cases itself — this is only a hand-off queue, kept
 * in memory and capped.
 */
export interface InboxEntry {
  id: string
  receivedAt: string
  source: string | null
  caseNames: string[]
  export: { version: 1 | 2; exportedAt: string; cases: unknown[] }
}

export class CaseInboxError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

const MAX_ENTRIES = 50

/** Same acceptance rule as the client's file import: version 1|2 with a cases array of named cases. */
export function validateExport(payload: unknown): InboxEntry['export'] {
  if (typeof payload !== 'object' || payload === null) throw new CaseInboxError('body must be a mintara export object')
  const { version, exportedAt, cases } = payload as { version?: unknown; exportedAt?: unknown; cases?: unknown }
  if (version !== 1 && version !== 2) throw new CaseInboxError('version must be 1 or 2')
  if (!Array.isArray(cases) || cases.length === 0) throw new CaseInboxError('cases must be a non-empty array')
  for (const c of cases) {
    if (typeof c !== 'object' || c === null || typeof (c as { name?: unknown }).name !== 'string' || !(c as { name: string }).name.trim()) {
      throw new CaseInboxError('every case needs a non-empty name')
    }
  }
  return { version, exportedAt: typeof exportedAt === 'string' ? exportedAt : new Date().toISOString(), cases }
}

export function createCaseInbox() {
  const entries: InboxEntry[] = []

  return {
    push(payload: unknown, source: string | null = null): InboxEntry {
      const exp = validateExport(payload)
      const entry: InboxEntry = {
        id: randomUUID(),
        receivedAt: new Date().toISOString(),
        source,
        caseNames: exp.cases.map((c) => (c as { name: string }).name),
        export: exp,
      }
      entries.push(entry)
      if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
      return entry
    },
    list(): InboxEntry[] {
      return [...entries]
    },
    remove(id: string): boolean {
      const idx = entries.findIndex((e) => e.id === id)
      if (idx === -1) return false
      entries.splice(idx, 1)
      return true
    },
  }
}

export type CaseInbox = ReturnType<typeof createCaseInbox>
