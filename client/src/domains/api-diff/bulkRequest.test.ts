import { describe, it, expect } from 'vitest'
import { buildBulkCompareRequest } from './bulkRequest'
import type { BulkRequestItem, CompareRequest } from '@mintara/shared'

const baseRequest: CompareRequest = {
  method: 'GET',
  path: '/global',
  targets: [
    { name: 'PHP 5', baseUrl: 'https://old.example.com', headers: { 'X-Env': 'legacy' } },
    { name: 'PHP 8', baseUrl: 'https://new.example.com', headers: {} },
  ],
  normalization: { ignoreFields: ['global'], sortArrays: false },
}

const baseItem: BulkRequestItem = {
  id: '1',
  method: 'POST',
  path: '/users',
  body: { name: 'Alice' },
}

describe('buildBulkCompareRequest', () => {
  it('uses item method/path/body, not the global request', () => {
    const result = buildBulkCompareRequest(baseItem, baseRequest, {}, false)
    expect(result.method).toBe('POST')
    expect(result.path).toBe('/users')
    expect(result.body).toEqual({ name: 'Alice' })
  })

  it('merges shared headers on top of each target, shared wins on conflict', () => {
    const result = buildBulkCompareRequest(baseItem, baseRequest, { 'X-Env': 'shared', 'X-Extra': '1' }, false)
    // target 0 already had X-Env: 'legacy' — shared headers win the conflict
    expect(result.targets[0].headers).toEqual({ 'X-Env': 'shared', 'X-Extra': '1' })
    // target 1 had no headers of its own — it just picks up the shared ones
    expect(result.targets[1].headers).toEqual({ 'X-Env': 'shared', 'X-Extra': '1' })
  })

  it('uses per-item headers instead of shared headers when usePerRequestHeaders is true', () => {
    const item: BulkRequestItem = { ...baseItem, headers: { Authorization: 'Bearer item-token' } }
    const result = buildBulkCompareRequest(item, baseRequest, { Authorization: 'Bearer shared-token' }, true)
    expect(result.targets[0].headers).toEqual({ 'X-Env': 'legacy', Authorization: 'Bearer item-token' })
  })

  it('falls back to global normalization when the item has none', () => {
    const result = buildBulkCompareRequest(baseItem, baseRequest, {}, false)
    expect(result.normalization).toEqual({ ignoreFields: ['global'], sortArrays: false })
  })

  it('uses the item normalization when present', () => {
    const item: BulkRequestItem = { ...baseItem, normalization: { ignoreFields: ['perItem'], sortArrays: true } }
    const result = buildBulkCompareRequest(item, baseRequest, {}, false)
    expect(result.normalization).toEqual({ ignoreFields: ['perItem'], sortArrays: true })
  })
})
