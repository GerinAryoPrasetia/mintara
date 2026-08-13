import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import axios from 'axios'
import { runComparison } from './runComparison.js'
import type { CompareRequest } from '@mintara/shared'

vi.mock('axios', () => ({ default: vi.fn() }))

const mockedAxios = axios as unknown as Mock

const baseRequest: CompareRequest = {
  method: 'GET',
  path: '/users/1',
  targets: [
    { name: 'PHP 5', baseUrl: 'https://old.example.com', headers: {} },
    { name: 'PHP 8', baseUrl: 'https://new.example.com', headers: {} },
  ],
  normalization: { ignoreFields: [], sortArrays: false },
}

describe('runComparison', () => {
  beforeEach(() => {
    mockedAxios.mockReset()
  })

  it('fires one request per target with the joined url and reports hasChanges: false for identical bodies', async () => {
    mockedAxios.mockResolvedValue({ status: 200, data: { id: 1 } })

    const result = await runComparison(baseRequest, { timeoutMs: 1000, delayMs: 0 })

    expect(mockedAxios).toHaveBeenCalledTimes(2)
    expect(mockedAxios).toHaveBeenNthCalledWith(1, expect.objectContaining({ url: 'https://old.example.com/users/1' }))
    expect(mockedAxios).toHaveBeenNthCalledWith(2, expect.objectContaining({ url: 'https://new.example.com/users/1' }))
    expect(result.targets.map((t) => t.status)).toEqual([200, 200])
    expect(result.hasChanges).toBe(false)
  })

  it('reports hasChanges: true when the first two bodies differ after normalization', async () => {
    mockedAxios
      .mockResolvedValueOnce({ status: 200, data: { id: 1 } })
      .mockResolvedValueOnce({ status: 200, data: { id: 2 } })

    const result = await runComparison(baseRequest, { timeoutMs: 1000, delayMs: 0 })

    expect(result.hasChanges).toBe(true)
  })

  it('ignores fields per the normalization options before diffing', async () => {
    mockedAxios
      .mockResolvedValueOnce({ status: 200, data: { id: 1, updatedAt: 'yesterday' } })
      .mockResolvedValueOnce({ status: 200, data: { id: 1, updatedAt: 'today' } })

    const result = await runComparison(
      { ...baseRequest, normalization: { ignoreFields: ['updatedAt'], sortArrays: false } },
      { timeoutMs: 1000, delayMs: 0 },
    )

    expect(result.hasChanges).toBe(false)
  })

  it('records a target as status 0 with an error message when the request throws', async () => {
    mockedAxios
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce({ status: 200, data: { id: 1 } })

    const result = await runComparison(baseRequest, { timeoutMs: 1000, delayMs: 0 })

    expect(result.targets[0]).toMatchObject({ status: 0, error: 'connect ECONNREFUSED', body: null })
  })

  it('joins a path without a leading slash the same way as one with it', async () => {
    mockedAxios.mockResolvedValue({ status: 200, data: {} })

    await runComparison({ ...baseRequest, path: 'users/1' }, { timeoutMs: 1000, delayMs: 0 })

    expect(mockedAxios).toHaveBeenNthCalledWith(1, expect.objectContaining({ url: 'https://old.example.com/users/1' }))
  })
})
