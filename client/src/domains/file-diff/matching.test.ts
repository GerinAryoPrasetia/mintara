import { describe, it, expect } from 'vitest'
import { groupMatchesByPath } from './matching'
import type { FileMatch } from '@mintara/shared'

function match(relativePath: string, content = ''): FileMatch {
  return { relativePath, content, sizeBytes: content.length, truncated: false }
}

describe('groupMatchesByPath', () => {
  it('pairs matches that share a relative path', () => {
    const original = [match('src/a.ts', 'old')]
    const modified = [match('src/a.ts', 'new')]
    const result = groupMatchesByPath(original, modified)
    expect(result.paired).toEqual([{ path: 'src/a.ts', original: original[0], modified: modified[0] }])
    expect(result.originalOnly).toEqual([])
    expect(result.modifiedOnly).toEqual([])
  })

  it('puts unmatched originals in originalOnly and unmatched modifieds in modifiedOnly', () => {
    const original = [match('src/only-original.ts')]
    const modified = [match('src/only-modified.ts')]
    const result = groupMatchesByPath(original, modified)
    expect(result.paired).toEqual([])
    expect(result.originalOnly).toEqual(original)
    expect(result.modifiedOnly).toEqual(modified)
  })

  it('handles a mix of paired and unpaired matches', () => {
    const original = [match('shared.ts', 'a'), match('old-only.ts')]
    const modified = [match('shared.ts', 'b'), match('new-only.ts')]
    const result = groupMatchesByPath(original, modified)
    expect(result.paired.map((p) => p.path)).toEqual(['shared.ts'])
    expect(result.originalOnly.map((m) => m.relativePath)).toEqual(['old-only.ts'])
    expect(result.modifiedOnly.map((m) => m.relativePath)).toEqual(['new-only.ts'])
  })

  it('returns empty groups for empty inputs', () => {
    const result = groupMatchesByPath([], [])
    expect(result).toEqual({ paired: [], originalOnly: [], modifiedOnly: [] })
  })
})
