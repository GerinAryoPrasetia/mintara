import { describe, it, expect } from 'vitest'
import { computeLineByLineDiff, computeUnifiedDiff } from './lineDiff'

describe('computeLineByLineDiff', () => {
  it('reports no diff for identical text', () => {
    const result = computeLineByLineDiff('a\nb\nc', 'a\nb\nc')
    expect(result.hasDiff).toBe(false)
    expect(result.left.every((l) => l.type === 'unchanged')).toBe(true)
    expect(result.right.every((l) => l.type === 'unchanged')).toBe(true)
  })

  it('marks a removed line on the left with a blank slot on the right', () => {
    const result = computeLineByLineDiff('a\nb\nc', 'a\nc')
    expect(result.hasDiff).toBe(true)
    const removed = result.left.find((l) => l.type === 'removed')
    expect(removed?.content).toBe('b')
    expect(result.right[result.left.indexOf(removed!)]).toEqual({ lineNumber: '', content: '', type: 'removed' })
  })

  it('marks an added line on the right with a blank slot on the left', () => {
    const result = computeLineByLineDiff('a\nc', 'a\nb\nc')
    expect(result.hasDiff).toBe(true)
    const added = result.right.find((l) => l.type === 'added')
    expect(added?.content).toBe('b')
  })

  it('handles empty inputs without throwing', () => {
    expect(computeLineByLineDiff('', '').hasDiff).toBe(false)
  })
})

describe('computeUnifiedDiff', () => {
  it('collapses unchanged lines into a single column', () => {
    const result = computeUnifiedDiff('a\nb\nc', 'a\nb\nc')
    expect(result.hasDiff).toBe(false)
    expect(result.lines.map((l) => l.content)).toEqual(['a', 'b', 'c'])
  })

  it('includes both removed and added lines for a changed line', () => {
    const result = computeUnifiedDiff('a\nb\nc', 'a\nx\nc')
    expect(result.hasDiff).toBe(true)
    const types = result.lines.map((l) => l.type)
    expect(types).toContain('removed')
    expect(types).toContain('added')
  })
})
