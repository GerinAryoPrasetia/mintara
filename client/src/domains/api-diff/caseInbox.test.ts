import { describe, it, expect } from 'vitest'
import { claimNextInboxEntry, type CaseInboxEntry } from './caseInbox'

const entry = (id: string): CaseInboxEntry => ({
  id,
  receivedAt: '2026-10-12T00:00:00.000Z',
  source: 'fixture-builder',
  caseNames: [`case-${id}`],
  export: { version: 1, exportedAt: '2026-10-12T00:00:00.000Z', cases: [] },
})

function fakeFetch(entries: CaseInboxEntry[], claimedElsewhere: string[] = []) {
  const calls: string[] = []
  const impl = async (url: string, init?: { method?: string }) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`)
    if (!init?.method) return { ok: true, status: 200, json: async () => entries }
    const id = decodeURIComponent(url.split('/').pop() ?? '')
    return { ok: !claimedElsewhere.includes(id), status: claimedElsewhere.includes(id) ? 404 : 204, json: async () => null }
  }
  return { impl, calls }
}

describe('claimNextInboxEntry', () => {
  it('returns null when the inbox is empty', async () => {
    expect(await claimNextInboxEntry(fakeFetch([]).impl)).toBeNull()
  })

  it('claims the oldest entry with DELETE before returning it', async () => {
    const { impl, calls } = fakeFetch([entry('a'), entry('b')])
    expect((await claimNextInboxEntry(impl))?.id).toBe('a')
    expect(calls).toEqual(['GET /api/cases/inbox', 'DELETE /api/cases/inbox/a'])
  })

  it('skips entries another tab already claimed', async () => {
    const { impl } = fakeFetch([entry('a'), entry('b')], ['a'])
    expect((await claimNextInboxEntry(impl))?.id).toBe('b')
  })

  it('returns null when the server is not ok', async () => {
    const impl = async () => ({ ok: false, status: 500, json: async () => [] })
    expect(await claimNextInboxEntry(impl)).toBeNull()
  })
})
