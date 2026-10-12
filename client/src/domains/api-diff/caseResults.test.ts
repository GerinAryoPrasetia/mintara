import { describe, it, expect } from 'vitest'
import {
  EMPTY_CASE_RESULTS,
  stashResults,
  restoreResults,
  dropResults,
  copyResults,
  hasResults,
} from './caseResults'
import type { CaseResults, CaseResultsCache } from './caseResults'
import type { CompareResult, BulkItemResult } from '@mintara/shared'

const compareResult: CompareResult = {
  hasChanges: true,
  targets: [
    { name: 'PHP 5', url: 'https://old.example.com/users', status: 200, responseTimeMs: 10, body: { id: 1 } },
    { name: 'PHP 8', url: 'https://new.example.com/users', status: 200, responseTimeMs: 12, body: { id: 2 } },
  ],
}

const bulkResult: BulkItemResult = {
  item: { id: 'i1', method: 'GET', path: '/a' },
  result: compareResult,
  error: null,
  status: 'done',
}

function results(overrides: Partial<CaseResults> = {}): CaseResults {
  return {
    result: compareResult,
    bulkResults: [bulkResult],
    singleSummary: 'one diff',
    bulkItemSummaries: { i1: 'item summary' },
    bulkAggregateSummary: 'aggregate',
    ...overrides,
  }
}

describe('stashResults / restoreResults', () => {
  it('round-trips a case’s results through the cache', () => {
    const cache = stashResults({}, 'case-a', results())
    expect(restoreResults(cache, 'case-a')).toEqual(results())
  })

  it('returns an empty snapshot for a case with no stashed results', () => {
    expect(restoreResults({}, 'never-run')).toEqual(EMPTY_CASE_RESULTS)
  })

  it('returns an empty snapshot when no case is active', () => {
    const cache = stashResults({}, 'case-a', results())
    expect(restoreResults(cache, null)).toEqual(EMPTY_CASE_RESULTS)
  })

  it('does not stash when no case is active', () => {
    expect(stashResults({}, null, results())).toEqual({})
  })

  it('replaces a previously stashed snapshot for the same case', () => {
    const first = stashResults({}, 'case-a', results({ singleSummary: 'old' }))
    const second = stashResults(first, 'case-a', results({ singleSummary: 'new' }))
    expect(restoreResults(second, 'case-a').singleSummary).toBe('new')
  })

  it('drops the entry instead of storing an empty snapshot', () => {
    const cache = stashResults({}, 'case-a', results())
    expect(stashResults(cache, 'case-a', EMPTY_CASE_RESULTS)).toEqual({})
  })

  it('leaves other cases’ results untouched', () => {
    const cache = stashResults(stashResults({}, 'a', results()), 'b', EMPTY_CASE_RESULTS)
    expect(restoreResults(cache, 'a')).toEqual(results())
  })
})

describe('dropResults', () => {
  it('removes one case’s results and keeps the rest', () => {
    const cache: CaseResultsCache = stashResults(stashResults({}, 'a', results()), 'b', results())
    const next = dropResults(cache, 'a')
    expect(restoreResults(next, 'a')).toEqual(EMPTY_CASE_RESULTS)
    expect(restoreResults(next, 'b')).toEqual(results())
  })
})

describe('copyResults', () => {
  it('copies a case’s results under a new name', () => {
    const cache = stashResults({}, 'a', results())
    const next = copyResults(cache, 'a', 'a (copy)')
    expect(restoreResults(next, 'a (copy)')).toEqual(results())
    expect(restoreResults(next, 'a')).toEqual(results())
  })

  it('is a no-op when the source has no results', () => {
    expect(copyResults({}, 'a', 'a (copy)')).toEqual({})
  })
})

describe('hasResults', () => {
  it('is false for an empty snapshot', () => {
    expect(hasResults(EMPTY_CASE_RESULTS)).toBe(false)
  })

  it('is true when a single result is present', () => {
    expect(hasResults({ ...EMPTY_CASE_RESULTS, result: compareResult })).toBe(true)
  })

  it('is true when bulk results are present', () => {
    expect(hasResults({ ...EMPTY_CASE_RESULTS, bulkResults: [bulkResult] })).toBe(true)
  })
})
