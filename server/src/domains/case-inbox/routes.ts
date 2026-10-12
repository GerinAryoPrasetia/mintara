import express, { Router } from 'express'
import { CaseInboxError, type CaseInbox } from './caseInbox.js'

/**
 * Mounted at /api/cases BEFORE the global express.json(): fixture exports can
 * exceed its default 100kb limit, so this router parses its own bodies.
 */
export function createCaseInboxRouter({ inbox }: { inbox: CaseInbox }) {
  const router = Router()
  router.use(express.json({ limit: '20mb' }))

  // Push an export (same JSON shape as a test-case export file)
  router.post('/inbox', (req, res) => {
    try {
      const source = typeof req.query.source === 'string' ? req.query.source : null
      const entry = inbox.push(req.body, source)
      res.status(201).json({ id: entry.id, caseNames: entry.caseNames })
    } catch (err) {
      const status = err instanceof CaseInboxError ? err.status : 500
      res.status(status).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // Pending entries, oldest first (the client imports and then acks each one)
  router.get('/inbox', (_req, res) => {
    res.json(inbox.list())
  })

  router.delete('/inbox/:id', (req, res) => {
    if (!inbox.remove(req.params.id)) {
      res.status(404).json({ error: 'inbox entry not found' })
      return
    }
    res.status(204).end()
  })

  return router
}
