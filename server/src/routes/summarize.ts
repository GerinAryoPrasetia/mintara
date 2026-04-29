import { Router } from 'express'
import { Ollama } from 'ollama'
import type { DiffNode } from '@mintara/shared'

export const summarizeRouter = Router()

interface TargetInfo {
  name: string
  status: number
  error?: string
}

interface SummarizeRequest {
  mode: 'single' | 'bulk-item' | 'bulk-aggregate'
  // single / bulk-item
  method?: string
  path?: string
  targetNames?: string[]
  targets?: TargetInfo[]
  diffs?: DiffNode[]
  hasChanges?: boolean
  // bulk-aggregate
  totalItems?: number
  passedItems?: number
  failedItems?: number
  commonDiffPaths?: string[]
}

summarizeRouter.post('/summarize', async (req, res) => {
  const apiKey = process.env.OLLAMA_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'OLLAMA_API_KEY not configured' })
    return
  }

  const body = req.body as SummarizeRequest
  const model = process.env.OLLAMA_MODEL ?? 'ministral-3:3b'

  let userPrompt: string

  if (body.mode === 'bulk-aggregate') {
    const paths = (body.commonDiffPaths ?? []).slice(0, 10)
    userPrompt = `Bulk API migration comparison:
- Total test cases: ${body.totalItems ?? 0}
- Matched (no diffs): ${body.passedItems ?? 0}
- Had differences: ${body.failedItems ?? 0}
${paths.length > 0 ? `\nMost common diff paths:\n${paths.map((p) => `- ${p}`).join('\n')}` : '\nNo differences found across all cases.'}

Summarize in max 2 sentences (under 250 characters). Be direct.`
  } else {
    const targets = body.targets ?? []
    const statuses = targets.map((t) => `${t.name}: HTTP ${t.status}${t.error ? ` (${t.error})` : ''}`)
    const statusMismatch = targets.length >= 2 && targets.some((t) => t.status !== targets[0].status)
    const errorTargets = targets.filter((t) => t.status === 0 || t.status >= 400)

    const activeDiffs = (body.diffs ?? []).filter((d) => d.status !== 'equal')
    const diffLines = activeDiffs
      .slice(0, 20)
      .map((d) => {
        if (d.status === 'changed') {
          return `- ${d.path} [changed]: ${JSON.stringify(d.valueA)} → ${JSON.stringify(d.valueB)}`
        }
        return `- ${d.path} [${d.status}]`
      })
      .join('\n')

    const statusSection = statuses.length > 0
      ? `HTTP statuses:\n${statuses.map((s) => `- ${s}`).join('\n')}`
      : ''

    const errorSection = errorTargets.length > 0
      ? `\nErrors:\n${errorTargets.map((t) => `- ${t.name}: ${t.error ?? `HTTP ${t.status}`}`).join('\n')}`
      : ''

    const diffSection = activeDiffs.length > 0
      ? `\nBody differences (${activeDiffs.length} total):\n${diffLines}`
      : '\nBody: identical responses.'

    userPrompt = `API comparison: ${body.method ?? 'GET'} ${body.path ?? '/'}
${statusSection}${errorSection}
${statusMismatch ? '⚠ Status code mismatch detected — focus on this.' : ''}${diffSection}

Summarize in max 2 sentences (under 250 characters). Be direct.${statusMismatch ? ' Prioritize the HTTP status difference.' : ''}`
  }

  const ollama = new Ollama({
    host: 'https://ollama.com',
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  try {
    const response = await ollama.chat({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are an API diff analyst. Output ONLY the final summary — no thinking, no counting, no reasoning, no preamble. Max 2 sentences, under 250 characters.',
        },
        { role: 'user', content: userPrompt },
      ],
    })

    const raw: string = response.message.content ?? 'No summary available.'
    // Hard cap: take first 2 sentences, then truncate to 250 chars
    const sentences = raw.trim().match(/[^.!?]*[.!?]+/g) ?? [raw.trim()]
    const twoSentences = sentences.slice(0, 2).join(' ').trim()
    const summary = twoSentences.length > 250 ? twoSentences.slice(0, 247) + '…' : twoSentences
    res.json({ summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `AI summarization failed: ${message}` })
  }
})
