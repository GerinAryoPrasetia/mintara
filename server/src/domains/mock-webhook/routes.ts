import { Router, type Response } from 'express'
import { MockStoreError, type MockStore } from './mockStore.js'
import type { LogEvent, RequestLog } from './requestLog.js'
import type { MockImportRequest, MockImportResult } from '@mintara/shared'

function sendError(res: Response, err: unknown) {
  if (err instanceof MockStoreError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  res.status(500).json({ error: err instanceof Error ? err.message : 'Unexpected error' })
}

/** Management API for mocks and their request logs, mounted under `/api`. */
export function createMockAdminRouter({ store, log, port }: { store: MockStore; log: RequestLog; port: number }) {
  const router = Router()

  router.get('/mocks/info', (_req, res) => {
    res.json({ port })
  })

  router.get('/mocks', (_req, res) => {
    res.json(store.list())
  })

  router.post('/mocks', async (req, res) => {
    const { slug } = (req.body ?? {}) as { slug?: string }
    try {
      if (typeof slug !== 'string') {
        res.status(400).json({ error: 'slug is required' })
        return
      }
      res.status(201).json(await store.create(slug.trim()))
    } catch (err) {
      sendError(res, err)
    }
  })

  // Same contract as test-case import: new slugs are created, existing ones
  // are overwritten or skipped per `resolutions` (skip when unspecified).
  router.post('/mocks/import', async (req, res) => {
    const { mocks, resolutions = {} } = (req.body ?? {}) as Partial<MockImportRequest>
    if (!Array.isArray(mocks)) {
      res.status(400).json({ error: 'mocks must be an array' })
      return
    }
    const result: MockImportResult = { created: [], overwritten: [], skipped: [], errors: [] }
    for (const m of mocks) {
      const slug = typeof m?.slug === 'string' ? m.slug.trim() : ''
      try {
        if (store.get(slug)) {
          if (resolutions[slug] !== 'overwrite') {
            result.skipped.push(slug)
            continue
          }
          await store.update(slug, { rules: m.rules ?? [], defaultResponse: m.defaultResponse })
          result.overwritten.push(slug)
        } else {
          await store.create(slug, m)
          result.created.push(slug)
        }
      } catch (err) {
        result.errors.push({ slug, error: err instanceof Error ? err.message : String(err) })
      }
    }
    res.json(result)
  })

  // Declared before '/mocks/:slug' routes so 'requests' isn't read as a slug
  router.delete('/mocks/requests', (_req, res) => {
    log.clearAll()
    res.status(204).end()
  })

  router.get('/mocks/:slug', (req, res) => {
    const mock = store.get(req.params.slug)
    if (!mock) {
      res.status(404).json({ error: 'mock not found' })
      return
    }
    res.json(mock)
  })

  router.put('/mocks/:slug', async (req, res) => {
    try {
      res.json(await store.update(req.params.slug, req.body ?? {}))
    } catch (err) {
      sendError(res, err)
    }
  })

  router.post('/mocks/:slug/rename', async (req, res) => {
    const { newSlug } = (req.body ?? {}) as { newSlug?: string }
    if (typeof newSlug !== 'string') {
      res.status(400).json({ error: 'newSlug is required' })
      return
    }
    try {
      const mock = await store.rename(req.params.slug, newSlug.trim())
      log.rename(req.params.slug, mock.slug)
      res.json(mock)
    } catch (err) {
      sendError(res, err)
    }
  })

  router.delete('/mocks/:slug', async (req, res) => {
    const existed = await store.remove(req.params.slug)
    log.clear(req.params.slug)
    res.status(existed ? 204 : 404).end()
  })

  router.get('/mocks/:slug/requests', (req, res) => {
    const limit = Number(req.query.limit)
    res.json(log.list(req.params.slug, Number.isFinite(limit) && limit > 0 ? limit : undefined))
  })

  router.delete('/mocks/:slug/requests', (req, res) => {
    log.clear(req.params.slug)
    res.status(204).end()
  })

  router.get('/mocks/:slug/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.write(': connected\n\n')

    const unsubscribe = log.subscribe(req.params.slug, (event: LogEvent) => {
      if (event.type === 'request') res.write(`event: request\ndata: ${JSON.stringify(event.request)}\n\n`)
      else res.write('event: cleared\ndata: {}\n\n')
    })
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000)

    req.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })

  return router
}
