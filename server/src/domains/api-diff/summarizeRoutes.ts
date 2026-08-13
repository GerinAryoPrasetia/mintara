import { Router } from 'express'
import { Ollama } from 'ollama'
import { buildSummaryPrompt, truncateSummary } from './buildSummaryPrompt.js'
import type { SummarizeRequest } from './buildSummaryPrompt.js'

export const summarizeRouter = Router()

summarizeRouter.post('/summarize', async (req, res) => {
  const apiKey = process.env.OLLAMA_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'OLLAMA_API_KEY not configured' })
    return
  }

  const body = req.body as SummarizeRequest
  const model = process.env.OLLAMA_MODEL ?? 'ministral-3:3b'
  const userPrompt = buildSummaryPrompt(body)

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
    res.json({ summary: truncateSummary(raw) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `AI summarization failed: ${message}` })
  }
})
