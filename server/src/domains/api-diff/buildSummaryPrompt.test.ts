import { describe, it, expect } from 'vitest'
import { buildSummaryPrompt, truncateSummary } from './buildSummaryPrompt.js'
import type { SummarizeRequest } from './buildSummaryPrompt.js'

describe('buildSummaryPrompt', () => {
  it('builds a bulk-aggregate prompt with totals and common diff paths', () => {
    const body: SummarizeRequest = {
      mode: 'bulk-aggregate',
      totalItems: 10,
      passedItems: 7,
      failedItems: 3,
      commonDiffPaths: ['user.updatedAt', 'meta.requestId'],
    }
    const prompt = buildSummaryPrompt(body)
    expect(prompt).toContain('Total test cases: 10')
    expect(prompt).toContain('Matched (no diffs): 7')
    expect(prompt).toContain('Had differences: 3')
    expect(prompt).toContain('- user.updatedAt')
    expect(prompt).toContain('- meta.requestId')
  })

  it('caps common diff paths at 10 for bulk-aggregate', () => {
    const body: SummarizeRequest = {
      mode: 'bulk-aggregate',
      commonDiffPaths: Array.from({ length: 15 }, (_, i) => `path.${i}`),
    }
    const prompt = buildSummaryPrompt(body)
    expect(prompt).toContain('path.9')
    expect(prompt).not.toContain('path.10')
  })

  it('notes no differences when bulk-aggregate has an empty commonDiffPaths', () => {
    const prompt = buildSummaryPrompt({ mode: 'bulk-aggregate', totalItems: 5, passedItems: 5, failedItems: 0 })
    expect(prompt).toContain('No differences found across all cases.')
  })

  it('builds a single-mode prompt with method, path, and target statuses', () => {
    const body: SummarizeRequest = {
      mode: 'single',
      method: 'POST',
      path: '/users',
      targets: [
        { name: 'PHP 5', status: 200 },
        { name: 'PHP 8', status: 200 },
      ],
      diffs: [{ path: 'user.age', status: 'changed', valueA: 30, valueB: 31 }],
      hasChanges: true,
    }
    const prompt = buildSummaryPrompt(body)
    expect(prompt).toContain('API comparison: POST /users')
    expect(prompt).toContain('PHP 5: HTTP 200')
    expect(prompt).toContain('user.age [changed]: 30 → 31')
  })

  it('flags a status mismatch and prioritizes it in the instruction', () => {
    const body: SummarizeRequest = {
      mode: 'single',
      targets: [
        { name: 'PHP 5', status: 200 },
        { name: 'PHP 8', status: 500 },
      ],
    }
    const prompt = buildSummaryPrompt(body)
    expect(prompt).toContain('Status code mismatch detected')
    expect(prompt).toContain('Prioritize the HTTP status difference.')
  })

  it('lists error targets separately', () => {
    const body: SummarizeRequest = {
      mode: 'bulk-item',
      targets: [
        { name: 'PHP 5', status: 200 },
        { name: 'PHP 8', status: 0, error: 'timeout' },
      ],
    }
    const prompt = buildSummaryPrompt(body)
    expect(prompt).toContain('Errors:')
    expect(prompt).toContain('PHP 8: timeout')
  })

  it('reports identical responses when there are no active diffs', () => {
    const body: SummarizeRequest = {
      mode: 'single',
      diffs: [{ path: 'a', status: 'equal' }],
    }
    const prompt = buildSummaryPrompt(body)
    expect(prompt).toContain('Body: identical responses.')
  })

  it('caps diff lines at 20', () => {
    const diffs = Array.from({ length: 25 }, (_, i) => ({ path: `field${i}`, status: 'changed' as const, valueA: 1, valueB: 2 }))
    const prompt = buildSummaryPrompt({ mode: 'single', diffs })
    expect(prompt).toContain('field19')
    expect(prompt).not.toContain('field20 [')
    expect(prompt).toContain('(25 total)')
  })
})

describe('truncateSummary', () => {
  it('passes short text through unchanged', () => {
    expect(truncateSummary('All good.')).toBe('All good.')
  })

  it('keeps only the first two sentences', () => {
    const raw = 'First sentence. Second sentence. Third sentence that should be dropped.'
    const result = truncateSummary(raw)
    expect(result).not.toContain('Third sentence')
    expect(result.replace(/\s+/g, ' ')).toBe('First sentence. Second sentence.')
  })

  it('hard-truncates to 250 characters with an ellipsis', () => {
    const longSentence = 'A'.repeat(300) + '.'
    const result = truncateSummary(longSentence)
    expect(result.length).toBe(248)
    expect(result.endsWith('…')).toBe(true)
  })

  it('falls back to the raw trimmed text when there is no sentence-ending punctuation', () => {
    expect(truncateSummary('  no punctuation here  ')).toBe('no punctuation here')
  })
})
