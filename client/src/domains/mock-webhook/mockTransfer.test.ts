import { describe, it, expect } from 'vitest'
import type { MockSlug } from '@mintara/shared'
import { buildExport, exportFileName, findConflicts, parseMocksFile, toExportedMock } from './mockTransfer'

const mock = (slug: string): MockSlug => ({
  slug,
  rules: [],
  defaultResponse: { status: 200, headers: {}, body: '' },
  createdAt: 't',
  updatedAt: 't',
})

describe('mockTransfer', () => {
  it('round-trips an export without server timestamps', () => {
    const file = buildExport([toExportedMock(mock('voucher'))], 'now')
    expect(file).toEqual({
      kind: 'mintara-mocks',
      version: 1,
      exportedAt: 'now',
      mocks: [{ slug: 'voucher', rules: [], defaultResponse: { status: 200, headers: {}, body: '' } }],
    })
    expect(parseMocksFile(JSON.parse(JSON.stringify(file)))).toEqual(file.mocks)
  })

  it('accepts a bare array or a single mock object', () => {
    expect(parseMocksFile([{ slug: 'a' }, { slug: 'b' }])).toHaveLength(2)
    expect(parseMocksFile({ slug: 'a', rules: [] })).toEqual([{ slug: 'a', rules: [] }])
  })

  it('rejects files that are not mocks (e.g. a test-case export)', () => {
    expect(parseMocksFile({ version: 2, cases: [] })).toBeNull()
    expect(parseMocksFile([{ name: 'x' }])).toBeNull()
    expect(parseMocksFile('nope')).toBeNull()
  })

  it('finds conflicts by slug', () => {
    expect(findConflicts([{ ...toExportedMock(mock('a')) }, toExportedMock(mock('z'))], [mock('a')]).map((m) => m.slug)).toEqual(['a'])
  })

  it('makes unique, filesystem-safe export file names', () => {
    const used = new Set<string>()
    expect(exportFileName('voucher', used)).toBe('voucher.json')
    expect(exportFileName('voucher', used)).toBe('voucher-2.json')
  })
})
