import type { CompareResult, BulkItemResult } from '@mintara/shared'

/**
 * Everything a single run produced for one Test Case — see CONTEXT.md.
 * Session-only: never persisted to localStorage (response bodies would
 * blow the quota), but carried along in test-case exports.
 */
export interface CaseResults {
  result: CompareResult | null
  bulkResults: BulkItemResult[]
  singleSummary: string | null
  bulkItemSummaries: Record<string, string>
  bulkAggregateSummary: string | null
}

/** Results held per case name, so switching cases shows that case's own run. */
export type CaseResultsCache = Record<string, CaseResults>

export const EMPTY_CASE_RESULTS: CaseResults = {
  result: null,
  bulkResults: [],
  singleSummary: null,
  bulkItemSummaries: {},
  bulkAggregateSummary: null,
}

/**
 * Park the on-screen results under `name`. Unsaved work (no active case) is
 * dropped, and an empty snapshot clears the entry rather than storing a husk.
 */
export function stashResults(
  cache: CaseResultsCache,
  name: string | null,
  results: CaseResults,
): CaseResultsCache {
  if (name === null) return cache
  if (!hasResults(results)) return dropResults(cache, name)
  return { ...cache, [name]: results }
}

/** The results belonging to `name`, or an empty snapshot if it has never been run. */
export function restoreResults(cache: CaseResultsCache, name: string | null): CaseResults {
  if (name === null) return EMPTY_CASE_RESULTS
  return cache[name] ?? EMPTY_CASE_RESULTS
}

export function dropResults(cache: CaseResultsCache, name: string): CaseResultsCache {
  const { [name]: _dropped, ...rest } = cache
  return rest
}

export function copyResults(cache: CaseResultsCache, from: string, to: string): CaseResultsCache {
  const found = cache[from]
  if (!found) return cache
  return { ...cache, [to]: found }
}

/** Whether a snapshot holds anything worth exporting. */
export function hasResults(results: CaseResults): boolean {
  return results.result !== null || results.bulkResults.length > 0
}

export function moveResults(cache: CaseResultsCache, from: string, to: string): CaseResultsCache {
  if (from === to) return cache
  return dropResults(copyResults(cache, from, to), from)
}
