import { describe, it, expect } from 'vitest'
import { diffTargets } from './diff'

describe('diffTargets', () => {
  it('returns no nodes for identical bodies', () => {
    const nodes = diffTargets({ a: 1 }, { a: 1 }, { ignoreFields: [], sortArrays: false })
    expect(nodes).toEqual([])
  })

  it('reports a changed field', () => {
    const nodes = diffTargets({ a: 1 }, { a: 2 }, { ignoreFields: [], sortArrays: false })
    expect(nodes).toEqual([{ path: 'a', status: 'changed', valueA: 1, valueB: 2 }])
  })

  it('respects ignoreFields', () => {
    const nodes = diffTargets(
      { a: 1, updatedAt: 'yesterday' },
      { a: 1, updatedAt: 'today' },
      { ignoreFields: ['updatedAt'], sortArrays: false },
    )
    expect(nodes).toEqual([])
  })

  it('respects sortArrays', () => {
    const nodes = diffTargets({ items: [1, 2] }, { items: [2, 1] }, { ignoreFields: [], sortArrays: true })
    expect(nodes).toEqual([])
  })

  it('does not ignore array order when sortArrays is false', () => {
    const nodes = diffTargets({ items: [1, 2] }, { items: [2, 1] }, { ignoreFields: [], sortArrays: false })
    expect(nodes.length).toBeGreaterThan(0)
  })
})
