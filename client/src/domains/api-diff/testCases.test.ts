import { describe, it, expect } from 'vitest'
import {
  saveCase,
  loadCase,
  deleteCase,
  switchCase,
  newCase,
  duplicateCase,
  saveCurrentCase,
  importCases,
  toSavedCase,
  fromSavedCase,
} from './testCases'
import type { SavedCase, WorkingCase } from './testCases'
import type { CompareRequest } from '@mintara/shared'

const request: CompareRequest = {
  method: 'GET',
  path: '/users',
  targets: [
    { name: 'PHP 5', baseUrl: 'https://old.example.com', headers: {} },
    { name: 'PHP 8', baseUrl: 'https://new.example.com', headers: {} },
  ],
  normalization: { ignoreFields: [], sortArrays: false },
}

function workingSingle(overrides: Partial<WorkingCase> = {}): WorkingCase {
  return {
    mode: 'single',
    request,
    bulkItems: [],
    bulkSharedHeaders: {},
    usePerRequestHeaders: false,
    ...overrides,
  }
}

function workingBulk(overrides: Partial<WorkingCase> = {}): WorkingCase {
  return {
    mode: 'bulk',
    request,
    bulkItems: [{ id: '1', method: 'GET', path: '/a' }],
    bulkSharedHeaders: { Authorization: 'Bearer x' },
    usePerRequestHeaders: true,
    ...overrides,
  }
}

describe('toSavedCase / fromSavedCase', () => {
  it('round-trips a single-mode working case without bulk fields', () => {
    const saved = toSavedCase('my-case', workingSingle())
    expect(saved).toEqual({ name: 'my-case', mode: 'single', config: request })
    const loaded = fromSavedCase(saved)
    expect(loaded).toEqual({ mode: 'single', request })
  })

  it('round-trips a bulk-mode working case with bulk fields', () => {
    const working = workingBulk()
    const saved = toSavedCase('bulk-case', working)
    expect(saved.bulkItems).toEqual(working.bulkItems)
    expect(saved.bulkSharedHeaders).toEqual(working.bulkSharedHeaders)
    expect(saved.usePerRequestHeaders).toBe(true)
    const loaded = fromSavedCase(saved)
    expect(loaded).toEqual({
      mode: 'bulk',
      request,
      bulkItems: working.bulkItems,
      bulkSharedHeaders: working.bulkSharedHeaders,
      usePerRequestHeaders: true,
    })
  })

  it('defaults missing bulk fields on load to empty/false', () => {
    const saved: SavedCase = { name: 'partial', mode: 'bulk', config: request }
    expect(fromSavedCase(saved)).toEqual({
      mode: 'bulk',
      request,
      bulkItems: [],
      bulkSharedHeaders: {},
      usePerRequestHeaders: false,
    })
  })
})

describe('saveCase', () => {
  it('adds a new case and makes it active', () => {
    const { cases, activeCaseName } = saveCase([], 'first', workingSingle())
    expect(cases).toHaveLength(1)
    expect(cases[0].name).toBe('first')
    expect(activeCaseName).toBe('first')
  })

  it('overwrites an existing case with the same name', () => {
    const existing: SavedCase = { name: 'first', mode: 'single', config: { ...request, path: '/old' } }
    const { cases } = saveCase([existing], 'first', workingSingle())
    expect(cases).toHaveLength(1)
    expect(cases[0].config.path).toBe('/users')
  })
})

describe('loadCase', () => {
  it('returns null for an unknown name', () => {
    expect(loadCase([], 'missing')).toBeNull()
  })

  it('returns the loaded shape for a known name', () => {
    const saved: SavedCase = { name: 'first', mode: 'single', config: request }
    expect(loadCase([saved], 'first')).toEqual({ mode: 'single', request })
  })
})

describe('deleteCase', () => {
  it('removes the case and clears activeCaseName if it was active', () => {
    const cases: SavedCase[] = [{ name: 'a', mode: 'single', config: request }]
    const result = deleteCase(cases, 'a', 'a')
    expect(result.cases).toHaveLength(0)
    expect(result.activeCaseName).toBeNull()
  })

  it('leaves activeCaseName untouched when deleting a different case', () => {
    const cases: SavedCase[] = [
      { name: 'a', mode: 'single', config: request },
      { name: 'b', mode: 'single', config: request },
    ]
    const result = deleteCase(cases, 'a', 'b')
    expect(result.cases.map((c) => c.name)).toEqual(['a'])
    expect(result.activeCaseName).toBe('a')
  })
})

describe('switchCase', () => {
  it('auto-saves the active case before loading a different one', () => {
    const cases: SavedCase[] = [
      { name: 'a', mode: 'single', config: { ...request, path: '/stale' } },
      { name: 'b', mode: 'single', config: { ...request, path: '/b' } },
    ]
    const working = workingSingle({ request: { ...request, path: '/edited' } })
    const result = switchCase(cases, 'a', working, 'b')
    expect(result.cases.find((c) => c.name === 'a')?.config.path).toBe('/edited')
    expect(result.activeCaseName).toBe('b')
    expect(result.toLoad).toEqual({ mode: 'single', request: { ...request, path: '/b' } })
  })

  it('does not auto-save when there is no active case', () => {
    const cases: SavedCase[] = [{ name: 'b', mode: 'single', config: request }]
    const result = switchCase(cases, null, workingSingle(), 'b')
    expect(result.cases).toEqual(cases)
    expect(result.toLoad).toEqual({ mode: 'single', request })
  })

  it('leaves cases and activeCaseName unchanged when the target does not exist', () => {
    const cases: SavedCase[] = [{ name: 'a', mode: 'single', config: request }]
    const result = switchCase(cases, 'a', workingSingle(), 'missing')
    expect(result.activeCaseName).toBe('a')
    expect(result.toLoad).toBeNull()
  })

  it('does not duplicate-save when switching to the already-active case', () => {
    const cases: SavedCase[] = [{ name: 'a', mode: 'single', config: request }]
    const result = switchCase(cases, 'a', workingSingle({ request: { ...request, path: '/unsaved-edit' } }), 'a')
    expect(result.cases).toHaveLength(1)
    expect(result.cases[0].config.path).toBe('/users')
  })
})

describe('newCase', () => {
  it('auto-saves the active case and clears activeCaseName', () => {
    const cases: SavedCase[] = [{ name: 'a', mode: 'single', config: { ...request, path: '/stale' } }]
    const working = workingSingle({ request: { ...request, path: '/edited' } })
    const result = newCase(cases, 'a', working)
    expect(result.cases[0].config.path).toBe('/edited')
    expect(result.activeCaseName).toBeNull()
  })

  it('is a no-op on cases when there is no active case', () => {
    const result = newCase([], null, workingSingle())
    expect(result.cases).toEqual([])
    expect(result.activeCaseName).toBeNull()
  })
})

describe('duplicateCase', () => {
  it('appends "(copy)" for the first duplicate', () => {
    const cases: SavedCase[] = [{ name: 'a', mode: 'single', config: request }]
    const result = duplicateCase(cases, 'a')
    expect(result.map((c) => c.name)).toEqual(['a', 'a (copy)'])
  })

  it('increments the counter when copies already exist', () => {
    const cases: SavedCase[] = [
      { name: 'a', mode: 'single', config: request },
      { name: 'a (copy)', mode: 'single', config: request },
    ]
    const result = duplicateCase(cases, 'a')
    expect(result.map((c) => c.name)).toEqual(['a', 'a (copy)', 'a (copy 2)'])
  })

  it('is a no-op when the source name does not exist', () => {
    expect(duplicateCase([], 'missing')).toEqual([])
  })
})

describe('saveCurrentCase', () => {
  it('switches to an existing different-named case without overwriting it', () => {
    const cases: SavedCase[] = [
      { name: 'a', mode: 'single', config: request },
      { name: 'b', mode: 'single', config: { ...request, path: '/b-untouched' } },
    ]
    const result = saveCurrentCase(cases, 'a', workingSingle({ request: { ...request, path: '/a-edit' } }), 'b')
    expect(result.activeCaseName).toBe('b')
    expect(result.cases.find((c) => c.name === 'b')?.config.path).toBe('/b-untouched')
  })

  it('saves under a new name', () => {
    const result = saveCurrentCase([], null, workingSingle(), 'brand-new')
    expect(result.cases.map((c) => c.name)).toEqual(['brand-new'])
    expect(result.activeCaseName).toBe('brand-new')
  })

  it('re-saves the active case over itself when the typed name matches it', () => {
    const cases: SavedCase[] = [{ name: 'a', mode: 'single', config: { ...request, path: '/stale' } }]
    const result = saveCurrentCase(cases, 'a', workingSingle({ request: { ...request, path: '/edited' } }), 'a')
    expect(result.cases[0].config.path).toBe('/edited')
  })

  it('saves the active case when no name is given', () => {
    const cases: SavedCase[] = [{ name: 'a', mode: 'single', config: { ...request, path: '/stale' } }]
    const result = saveCurrentCase(cases, 'a', workingSingle({ request: { ...request, path: '/edited' } }))
    expect(result.cases[0].config.path).toBe('/edited')
  })

  it('is a no-op when there is no name and no active case', () => {
    const result = saveCurrentCase([], null, workingSingle())
    expect(result).toEqual({ cases: [], activeCaseName: null })
  })
})

describe('importCases', () => {
  it('adds non-conflicting cases', () => {
    const result = importCases([], [{ name: 'a', mode: 'single', config: request }], {})
    expect(result.map((c) => c.name)).toEqual(['a'])
  })

  it('overwrites when resolution says overwrite', () => {
    const existing: SavedCase[] = [{ name: 'a', mode: 'single', config: { ...request, path: '/old' } }]
    const incoming: SavedCase[] = [{ name: 'a', mode: 'single', config: { ...request, path: '/new' } }]
    const result = importCases(existing, incoming, { a: 'overwrite' })
    expect(result[0].config.path).toBe('/new')
  })

  it('leaves existing untouched when resolution says skip or is missing', () => {
    const existing: SavedCase[] = [{ name: 'a', mode: 'single', config: { ...request, path: '/old' } }]
    const incoming: SavedCase[] = [{ name: 'a', mode: 'single', config: { ...request, path: '/new' } }]
    expect(importCases(existing, incoming, { a: 'skip' })[0].config.path).toBe('/old')
    expect(importCases(existing, incoming, {})[0].config.path).toBe('/old')
  })
})
