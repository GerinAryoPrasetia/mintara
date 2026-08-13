import axios from 'axios'
import { normalize, compare } from '@mintara/shared'
import type { CompareRequest, TargetResult, CompareResult } from '@mintara/shared'

export interface RunComparisonOptions {
  timeoutMs: number
  /** Delay between sequential target requests, in ms. Defaults to 300 — kept low in tests. */
  delayMs?: number
}

/**
 * Fires the request at each target sequentially (deliberately, not in
 * parallel — spreads load on shared backend DB connection pools during
 * migration testing) and diffs the first two bodies for hasChanges.
 */
export async function runComparison(
  request: CompareRequest,
  options: RunComparisonOptions,
): Promise<CompareResult> {
  const { method, path, targets, body: requestBody, normalization } = request
  const delayMs = options.delayMs ?? 300
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const targetResults: TargetResult[] = []
  for (const target of targets) {
    const fullUrl = target.baseUrl.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`)
    const start = Date.now()
    try {
      console.log(`[${target.name}] ${method.toUpperCase()} ${fullUrl}`)
      const response = await axios({
        method: method.toLowerCase(),
        url: fullUrl,
        headers: target.headers ?? {},
        data: requestBody,
        timeout: options.timeoutMs,
        validateStatus: () => true,
      })
      targetResults.push({
        name: target.name,
        url: fullUrl,
        status: response.status,
        responseTimeMs: Date.now() - start,
        body: response.data,
      } satisfies TargetResult)
    } catch (err) {
      targetResults.push({
        name: target.name,
        url: fullUrl,
        status: 0,
        responseTimeMs: Date.now() - start,
        body: null,
        error: err instanceof Error ? err.message : String(err),
      } satisfies TargetResult)
    }
    await delay(delayMs)
  }

  const normA = normalize(targetResults[0].body, normalization)
  const normB = normalize(targetResults[1].body, normalization)
  const diffNodes = compare(normA, normB, '')

  return { targets: targetResults, hasChanges: diffNodes.length > 0 }
}
