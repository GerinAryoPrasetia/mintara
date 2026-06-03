import { Router } from 'express'
import axios from 'axios'
import { normalize, compare } from '@mintara/shared'
import type { CompareRequest, TargetResult, CompareResult } from '@mintara/shared'

export const compareRouter = Router()

compareRouter.get('/health', (_req, res) => {
  res.json({ ok: true })
})

compareRouter.post('/compare', async (req, res) => {
  const body = req.body as Partial<CompareRequest>

  // Basic validation
  if (!body.targets || !Array.isArray(body.targets) || body.targets.length < 2) {
    res.status(400).json({ error: 'At least 2 targets are required' })
    return
  }
  if (!body.method || !body.normalization) {
    res.status(400).json({ error: 'method and normalization are required' })
    return
  }

  const { method, path, targets, body: requestBody, normalization } = body as CompareRequest
  const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 10000)

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  // Fire requests sequentially to avoid overwhelming the DB connection pool
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
        timeout: timeoutMs,
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
    await delay(300)
  }

  // Pre-check A vs B for hasChanges (normalized)
  const normA = normalize(targetResults[0].body, normalization)
  const normB = normalize(targetResults[1].body, normalization)
  const diffNodes = compare(normA, normB, '')
  const hasChanges = diffNodes.length > 0

  const result: CompareResult = {
    targets: targetResults,
    hasChanges,
  }

  res.json(result)
})
