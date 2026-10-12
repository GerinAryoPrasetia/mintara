import express, { Router, type Request } from 'express'
import { randomUUID } from 'crypto'
import type { MockResponse, RecordedRequest } from '@mintara/shared'
import { matchRule, normalizeSubPath } from './matchRule.js'
import { renderTemplate } from './template.js'
import type { MockStore } from './mockStore.js'
import type { RequestLog } from './requestLog.js'

const UNKNOWN_SLUG_RESPONSE: MockResponse = {
  status: 404,
  headers: { 'Content-Type': 'application/json' },
  body: '{"error":"unknown mock slug"}',
}

function readRawBody(req: Request): string {
  return Buffer.isBuffer(req.body) ? req.body.toString('utf8') : ''
}

function parseJson(raw: string): unknown | null {
  if (!raw.trim()) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function flatHeaders(req: Request): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) out[k] = v
  return out
}

/**
 * Catch-all receiver mounted at `/hook`. Must be mounted BEFORE the global
 * express.json() so it sees the untouched body. Never logs the body.
 */
export function createHookRouter({ store, log }: { store: MockStore; log: RequestLog }) {
  const router = Router()
  router.use(express.raw({ type: () => true, limit: '10mb' }))

  router.all(['/:slug', '/:slug/*'], async (req, res) => {
    const slug = req.params.slug ?? ''
    const subPath = normalizeSubPath((req.params as Record<string, string | undefined>)[0] ?? '')
    const rawBody = readRawBody(req)
    const jsonBody = parseJson(rawBody)
    const query = req.query as Record<string, string | string[]>
    const headers = flatHeaders(req)

    const mock = store.get(slug)
    const match = matchRule(mock, req.method, subPath)
    const source =
      match.kind === 'rule' ? match.rule.response : match.kind === 'default' ? mock!.defaultResponse : UNKNOWN_SLUG_RESPONSE
    const body =
      match.kind === 'unknown-slug' ? source.body : renderTemplate(source.body, { body: jsonBody, query, headers })

    const sent: RecordedRequest['response'] = {
      ...source,
      headers: { ...source.headers },
      body,
      matched: match.kind,
      ...(match.kind === 'rule' && { ruleId: match.rule.id }),
    }

    log.add({
      id: randomUUID(),
      slug,
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      subPath,
      query,
      headers,
      rawBody,
      jsonBody,
      ip: req.ip ?? req.socket.remoteAddress ?? '',
      response: sent,
    })

    if (source.delayMs) await new Promise((r) => setTimeout(r, source.delayMs))

    res.status(source.status)
    for (const [k, v] of Object.entries(source.headers)) res.setHeader(k, v)
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json')
    // A Buffer keeps Express from guessing a content type or re-encoding the body
    res.send(Buffer.from(body, 'utf8'))
  })

  return router
}
