import { Router } from 'express'
import { runComparison } from './runComparison.js'
import type { CompareRequest, CompareResult } from '@mintara/shared'

export const apiDiffRouter = Router()

apiDiffRouter.get('/health', (_req, res) => {
  res.json({ ok: true })
})

apiDiffRouter.post('/compare', async (req, res) => {
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

  const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 10000)
  const result: CompareResult = await runComparison(body as CompareRequest, { timeoutMs })
  res.json(result)
})
