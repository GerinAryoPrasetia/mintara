import { describe, it, expect } from 'vitest'
import { normalize } from '../normalize'

describe('normalize', () => {
  it('passes primitives, null, and undefined through unchanged', () => {
    expect(normalize(1, { ignoreFields: [], sortArrays: false })).toBe(1)
    expect(normalize('a', { ignoreFields: [], sortArrays: false })).toBe('a')
    expect(normalize(null, { ignoreFields: [], sortArrays: false })).toBeNull()
    expect(normalize(undefined, { ignoreFields: [], sortArrays: false })).toBeUndefined()
  })

  it('strips top-level ignored fields', () => {
    const result = normalize({ id: 1, updatedAt: 'now' }, { ignoreFields: ['updatedAt'], sortArrays: false })
    expect(result).toEqual({ id: 1 })
  })

  it('strips nested ignored fields by dot-notation path', () => {
    const result = normalize(
      { user: { id: 1, updatedAt: 'now' } },
      { ignoreFields: ['user.updatedAt'], sortArrays: false },
    )
    expect(result).toEqual({ user: { id: 1 } })
  })

  it('does not strip a field with a matching name at a different path', () => {
    const result = normalize(
      { user: { updatedAt: 'now' }, updatedAt: 'also now' },
      { ignoreFields: ['user.updatedAt'], sortArrays: false },
    )
    expect(result).toEqual({ user: {}, updatedAt: 'also now' })
  })

  it('recurses into array elements without a path suffix', () => {
    const result = normalize(
      [{ id: 1, updatedAt: 'now' }],
      { ignoreFields: ['updatedAt'], sortArrays: false },
    )
    expect(result).toEqual([{ id: 1 }])
  })

  it('leaves array order untouched when sortArrays is false', () => {
    const result = normalize([3, 1, 2], { ignoreFields: [], sortArrays: false })
    expect(result).toEqual([3, 1, 2])
  })

  it('sorts arrays by JSON.stringify order when sortArrays is true', () => {
    const result = normalize([3, 1, 2], { ignoreFields: [], sortArrays: true })
    expect(result).toEqual([1, 2, 3])
  })

  it('sorts nested arrays independently at each level', () => {
    const result = normalize(
      { items: [{ id: 2 }, { id: 1 }] },
      { ignoreFields: [], sortArrays: true },
    )
    expect(result).toEqual({ items: [{ id: 1 }, { id: 2 }] })
  })
})
