import { describe, it, expect, beforeEach } from 'vitest'
import { useApiDiffStore, DEFAULT_REQUEST } from './store'
import type { SavedCase } from './testCases'
import { EMPTY_CASE_RESULTS } from './caseResults'
import type { CompareResult, BulkItemResult } from '@mintara/shared'

const compareResult = (hasChanges: boolean): CompareResult => ({
  hasChanges,
  targets: [
    { name: 'PHP 5', url: 'https://old.example.com/u', status: 200, responseTimeMs: 10, body: { id: 1 } },
    { name: 'PHP 8', url: 'https://new.example.com/u', status: 200, responseTimeMs: 12, body: { id: hasChanges ? 2 : 1 } },
  ],
})

const bulkResult = (id: string): BulkItemResult => ({
  item: { id, method: 'GET', path: `/${id}` },
  result: compareResult(false),
  error: null,
  status: 'done',
})

beforeEach(() => {
  useApiDiffStore.setState({
    savedCases: [],
    activeCaseName: null,
    caseResults: {},
    result: null,
    bulkResults: [],
    singleSummary: null,
    bulkItemSummaries: {},
    bulkAggregateSummary: null,
    mode: 'single',
  })
})

describe('switching test cases', () => {
  it('restores the results that belong to the case being switched to', () => {
    const store = useApiDiffStore.getState()
    store.setRequest({ path: '/a' })
    store.saveCase('case-a')
    useApiDiffStore.setState({ result: compareResult(true), singleSummary: 'a-summary' })

    useApiDiffStore.getState().newCase()
    useApiDiffStore.getState().setRequest({ path: '/b' })
    useApiDiffStore.getState().saveCase('case-b')
    useApiDiffStore.setState({ result: compareResult(false), singleSummary: 'b-summary' })

    useApiDiffStore.getState().switchCase('case-a')
    expect(useApiDiffStore.getState().result).toEqual(compareResult(true))
    expect(useApiDiffStore.getState().singleSummary).toBe('a-summary')

    useApiDiffStore.getState().switchCase('case-b')
    expect(useApiDiffStore.getState().result).toEqual(compareResult(false))
    expect(useApiDiffStore.getState().singleSummary).toBe('b-summary')
  })

  it('clears stale bulk results when the target case has never been run', () => {
    const store = useApiDiffStore.getState()
    store.saveCase('case-a')
    useApiDiffStore.setState({ bulkResults: [bulkResult('i1')], bulkAggregateSummary: 'agg' })
    useApiDiffStore.getState().newCase()
    useApiDiffStore.getState().setRequest({ path: '/b' })
    useApiDiffStore.getState().saveCase('case-b')

    useApiDiffStore.getState().switchCase('case-b')
    expect(useApiDiffStore.getState().bulkResults).toEqual([])
    expect(useApiDiffStore.getState().bulkAggregateSummary).toBeNull()

    useApiDiffStore.getState().switchCase('case-a')
    expect(useApiDiffStore.getState().bulkResults).toEqual([bulkResult('i1')])
    expect(useApiDiffStore.getState().bulkAggregateSummary).toBe('agg')
  })

  it('clears results when starting a new case', () => {
    useApiDiffStore.getState().saveCase('case-a')
    useApiDiffStore.setState({ result: compareResult(true) })
    useApiDiffStore.getState().newCase()
    expect(useApiDiffStore.getState().result).toBeNull()
    expect(useApiDiffStore.getState().caseResults['case-a'].result).toEqual(compareResult(true))
  })

  it('removes a deleted case from the saved list', () => {
    useApiDiffStore.getState().saveCase('case-a')
    useApiDiffStore.getState().newCase()
    useApiDiffStore.getState().setRequest({ path: '/b' })
    useApiDiffStore.getState().saveCase('case-b')

    useApiDiffStore.getState().deleteCase('case-a')
    expect(useApiDiffStore.getState().savedCases.map((c) => c.name)).toEqual(['case-b'])
  })

  it('clears the active case when it is the one deleted', () => {
    useApiDiffStore.getState().saveCase('case-a')
    useApiDiffStore.getState().deleteCase('case-a')
    expect(useApiDiffStore.getState().savedCases).toEqual([])
    expect(useApiDiffStore.getState().activeCaseName).toBeNull()
  })

  it('drops a deleted case’s results', () => {
    useApiDiffStore.getState().saveCase('case-a')
    useApiDiffStore.setState({ result: compareResult(true) })
    useApiDiffStore.getState().newCase()
    useApiDiffStore.getState().deleteCase('case-a')
    expect(useApiDiffStore.getState().caseResults).toEqual({})
  })

  it('keeps the previous case’s results when saving under a new name', () => {
    useApiDiffStore.getState().saveCase('case-a')
    useApiDiffStore.setState({ result: compareResult(true) })
    useApiDiffStore.getState().saveCase('case-b')
    expect(useApiDiffStore.getState().caseResults['case-a'].result).toEqual(compareResult(true))
  })

  it('copies results onto a duplicated case', () => {
    useApiDiffStore.getState().saveCase('case-a')
    useApiDiffStore.setState({ result: compareResult(true) })
    useApiDiffStore.getState().newCase()
    useApiDiffStore.getState().duplicateCase('case-a')
    expect(useApiDiffStore.getState().caseResults['case-a (copy)'].result).toEqual(compareResult(true))
  })
})

describe('resultsForCase', () => {
  it('reads live on-screen state for the active case', () => {
    useApiDiffStore.getState().saveCase('case-a')
    useApiDiffStore.setState({ result: compareResult(true), singleSummary: 'live' })
    const results = useApiDiffStore.getState().resultsForCase('case-a')
    expect(results.result).toEqual(compareResult(true))
    expect(results.singleSummary).toBe('live')
  })

  it('reads the cache for a case that is not active', () => {
    useApiDiffStore.getState().saveCase('case-a')
    useApiDiffStore.setState({ result: compareResult(true) })
    useApiDiffStore.getState().newCase()
    expect(useApiDiffStore.getState().resultsForCase('case-a').result).toEqual(compareResult(true))
  })

  it('returns an empty snapshot for a case that has never been run', () => {
    useApiDiffStore.getState().saveCase('case-a')
    useApiDiffStore.getState().newCase()
    expect(useApiDiffStore.getState().resultsForCase('case-a')).toEqual(EMPTY_CASE_RESULTS)
  })
})

describe('importing cases with results', () => {
  it('stores incoming results in the session cache without persisting them on the case', () => {
    const results = { ...EMPTY_CASE_RESULTS, result: compareResult(true) }
    useApiDiffStore.getState().importCases(
      [{ name: 'imported', mode: 'single', config: useApiDiffStore.getState().request, results }],
      {},
    )
    expect(useApiDiffStore.getState().savedCases[0]).not.toHaveProperty('results')
    expect(useApiDiffStore.getState().caseResults.imported.result).toEqual(compareResult(true))
  })

  it('does not import results for a case the user chose to skip', () => {
    useApiDiffStore.getState().saveCase('dupe')
    useApiDiffStore.getState().newCase()
    const results = { ...EMPTY_CASE_RESULTS, result: compareResult(true) }
    useApiDiffStore.getState().importCases(
      [{ name: 'dupe', mode: 'single', config: useApiDiffStore.getState().request, results }],
      { dupe: 'skip' },
    )
    expect(useApiDiffStore.getState().caseResults.dupe).toBeUndefined()
  })
})

describe('after a page reload', () => {
  // Only savedCases + activeCaseName are persisted; the working state (request,
  // bulkItems) resets. This is exactly the state the store rehydrates into.
  const reloadedWith = (cases: SavedCase[], activeCaseName: string | null) => {
    useApiDiffStore.setState({
      savedCases: cases,
      activeCaseName,
      caseResults: {},
      request: { ...DEFAULT_REQUEST },
      mode: 'single',
      bulkItems: [],
      bulkSharedHeaders: {},
      usePerRequestHeaders: false,
      result: null,
      bulkResults: [],
    })
    // Mirrors the store's own `onRehydrateStorage` hook, which runs as soon as
    // persisted state is read back on page load.
    useApiDiffStore.getState().rehydrateActiveCase()
  }

  const bulkCase: SavedCase = {
    name: 'my-bulk-case',
    mode: 'bulk',
    config: { ...DEFAULT_REQUEST, path: '/kept' },
    bulkItems: [
      { id: 'i1', method: 'GET', path: '/one' },
      { id: 'i2', method: 'GET', path: '/two' },
    ],
    bulkSharedHeaders: { Authorization: 'Bearer x' },
    usePerRequestHeaders: true,
  }

  it('does not wipe the active case when switching to another one', () => {
    reloadedWith([bulkCase, { name: 'other', mode: 'single', config: DEFAULT_REQUEST }], 'my-bulk-case')

    useApiDiffStore.getState().switchCase('other')

    const kept = useApiDiffStore.getState().savedCases.find((c) => c.name === 'my-bulk-case')
    expect(kept?.bulkItems).toHaveLength(2)
    expect(kept?.mode).toBe('bulk')
  })

  it('clears a dangling active case that no longer exists', () => {
    reloadedWith([{ name: 'other', mode: 'single', config: DEFAULT_REQUEST }], 'deleted-elsewhere')
    expect(useApiDiffStore.getState().activeCaseName).toBeNull()
  })

  it('does not wipe the active case when starting a new one', () => {
    reloadedWith([bulkCase], 'my-bulk-case')

    useApiDiffStore.getState().newCase()

    const kept = useApiDiffStore.getState().savedCases.find((c) => c.name === 'my-bulk-case')
    expect(kept?.bulkItems).toHaveLength(2)
  })

  it('restores the active case onto the working state so it can be run', () => {
    reloadedWith([bulkCase], 'my-bulk-case')

    expect(useApiDiffStore.getState().mode).toBe('bulk')
    expect(useApiDiffStore.getState().bulkItems).toHaveLength(2)
    expect(useApiDiffStore.getState().request.path).toBe('/kept')
  })
})

describe('deleting an imported case', () => {
  it('removes it from the list', () => {
    useApiDiffStore.setState({ savedCases: [], activeCaseName: null, caseResults: {} })
    useApiDiffStore.getState().importCases(
      [
        { name: 'imported-a', mode: 'single', config: DEFAULT_REQUEST },
        { name: 'imported-b', mode: 'single', config: DEFAULT_REQUEST },
      ],
      {},
    )
    useApiDiffStore.getState().deleteCase('imported-a')
    expect(useApiDiffStore.getState().savedCases.map((c) => c.name)).toEqual(['imported-b'])
  })
})

describe('persist rehydration (real storage round-trip)', () => {
  it('restores the active case through zustand persist, not just a hand call', async () => {
    const bulkCase: SavedCase = {
      name: 'persisted-bulk',
      mode: 'bulk',
      config: { ...DEFAULT_REQUEST, path: '/kept' },
      bulkItems: [
        { id: 'i1', method: 'GET', path: '/one' },
        { id: 'i2', method: 'GET', path: '/two' },
      ],
      bulkSharedHeaders: {},
      usePerRequestHeaders: false,
    }
    localStorage.setItem(
      'mintara-storage',
      JSON.stringify({ state: { savedCases: [bulkCase], activeCaseName: 'persisted-bulk' }, version: 0 }),
    )
    // Wipe the working state the way a page load does, then let persist rehydrate.
    useApiDiffStore.setState({ request: { ...DEFAULT_REQUEST }, mode: 'single', bulkItems: [] })

    await useApiDiffStore.persist.rehydrate()

    expect(useApiDiffStore.getState().mode).toBe('bulk')
    expect(useApiDiffStore.getState().bulkItems).toHaveLength(2)
    expect(useApiDiffStore.getState().request.path).toBe('/kept')
  })
})

describe('renaming a test case', () => {
  it('moves the cached results of an inactive case to the new name', () => {
    const store = useApiDiffStore.getState()
    store.saveCase('old')
    useApiDiffStore.setState({ result: compareResult(true) })
    store.newCase() // stashes 'old' results into the cache

    expect(useApiDiffStore.getState().renameCase('old', 'new')).toBeNull()

    const state = useApiDiffStore.getState()
    expect(state.savedCases.map((c) => c.name)).toEqual(['new'])
    expect(state.caseResults.old).toBeUndefined()
    expect(state.resultsForCase('new').result).toEqual(compareResult(true))
  })

  it('keeps the active case active under its new name with its on-screen results', () => {
    const store = useApiDiffStore.getState()
    store.saveCase('old')
    useApiDiffStore.setState({ result: compareResult(false) })

    expect(useApiDiffStore.getState().renameCase('old', 'new')).toBeNull()

    const state = useApiDiffStore.getState()
    expect(state.activeCaseName).toBe('new')
    expect(state.result).toEqual(compareResult(false))
  })

  it('returns an error and changes nothing on a name collision', () => {
    const store = useApiDiffStore.getState()
    store.saveCase('a')
    store.saveCase('b')
    const before = useApiDiffStore.getState().savedCases

    expect(useApiDiffStore.getState().renameCase('a', 'b')).toBe('A case named "b" already exists')
    expect(useApiDiffStore.getState().savedCases).toBe(before)
  })
})
