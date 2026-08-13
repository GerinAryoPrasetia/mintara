import { describe, it, expect } from 'vitest'
import { compare } from '../compare'

describe('compare', () => {
  it('returns no nodes for identical primitives', () => {
    expect(compare(1, 1, '')).toEqual([])
    expect(compare('a', 'a', '')).toEqual([])
  })

  it('reports a changed primitive at the root path', () => {
    expect(compare(1, 2, '')).toEqual([{ path: '', status: 'changed', valueA: 1, valueB: 2 }])
  })

  it('reports a changed field with a dot-notation path', () => {
    const nodes = compare({ user: { age: 30 } }, { user: { age: 31 } }, '')
    expect(nodes).toEqual([{ path: 'user.age', status: 'changed', valueA: 30, valueB: 31 }])
  })

  it('reports a key present only in b as added', () => {
    const nodes = compare({ a: 1 }, { a: 1, b: 2 }, '')
    expect(nodes).toEqual([{ path: 'b', status: 'added', valueA: undefined, valueB: 2 }])
  })

  it('reports a key present only in a as removed', () => {
    const nodes = compare({ a: 1, b: 2 }, { a: 1 }, '')
    expect(nodes).toEqual([{ path: 'b', status: 'removed', valueA: 2, valueB: undefined }])
  })

  it('reports extra array elements in b as added at their index path', () => {
    const nodes = compare({ items: [1] }, { items: [1, 2] }, '')
    expect(nodes).toEqual([{ path: 'items[1]', status: 'added', valueA: undefined, valueB: 2 }])
  })

  it('reports missing array elements as removed at their index path', () => {
    const nodes = compare({ items: [1, 2] }, { items: [1] }, '')
    expect(nodes).toEqual([{ path: 'items[1]', status: 'removed', valueA: 2, valueB: undefined }])
  })

  it('diffs array elements by position, not value equality', () => {
    const nodes = compare([1, 2, 3], [1, 9, 3], '')
    expect(nodes).toEqual([{ path: '[1]', status: 'changed', valueA: 2, valueB: 9 }])
  })

  it('returns no nodes for deeply equal nested structures', () => {
    const a = { user: { id: 1, tags: ['x', 'y'] } }
    const b = { user: { id: 1, tags: ['x', 'y'] } }
    expect(compare(a, b, '')).toEqual([])
  })

  it('does not infinite-loop on a circular reference', () => {
    const a: Record<string, unknown> = { name: 'a' }
    a.self = a
    const b: Record<string, unknown> = { name: 'a' }
    b.self = b
    expect(() => compare(a, b, '')).not.toThrow()
    expect(compare(a, b, '')).toEqual([])
  })
})
