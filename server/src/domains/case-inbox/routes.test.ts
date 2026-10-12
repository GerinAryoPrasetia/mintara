import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createCaseInbox } from './caseInbox.js'
import { createCaseInboxRouter } from './routes.js'

// Mirrors server/src/index.ts: /api/cases before the global express.json()
function buildApp() {
  const app = express()
  app.use('/api/cases', createCaseInboxRouter({ inbox: createCaseInbox() }))
  app.use(express.json())
  return app
}

const bulkCase = (name: string) => ({
  name,
  mode: 'bulk',
  config: { method: 'GET', path: '', targets: [], normalization: { ignoreFields: [], sortArrays: false } },
  bulkItems: [{ id: 'a', method: 'POST', path: '/x', body: {}, headers: {} }],
  bulkSharedHeaders: {},
  usePerRequestHeaders: false,
})

describe('case inbox routes', () => {
  let app: express.Express

  beforeEach(() => {
    app = buildApp()
  })

  it('queues an export, lists it, and removes it on ack', async () => {
    const pushed = await request(app)
      .post('/api/cases/inbox?source=fixture-builder')
      .send({ version: 1, exportedAt: '2026-10-12T00:00:00.000Z', cases: [bulkCase('esb_api_pull')] })
      .expect(201)
    expect(pushed.body.caseNames).toEqual(['esb_api_pull'])

    const listed = await request(app).get('/api/cases/inbox').expect(200)
    expect(listed.body).toHaveLength(1)
    expect(listed.body[0]).toMatchObject({ id: pushed.body.id, source: 'fixture-builder', caseNames: ['esb_api_pull'] })
    expect(listed.body[0].export.cases[0].bulkItems).toHaveLength(1)

    await request(app).delete(`/api/cases/inbox/${pushed.body.id}`).expect(204)
    expect((await request(app).get('/api/cases/inbox')).body).toEqual([])
    await request(app).delete(`/api/cases/inbox/${pushed.body.id}`).expect(404)
  })

  it('rejects payloads the client import would reject', async () => {
    await request(app).post('/api/cases/inbox').send({ version: 3, cases: [bulkCase('x')] }).expect(400)
    await request(app).post('/api/cases/inbox').send({ version: 1, cases: [] }).expect(400)
    await request(app).post('/api/cases/inbox').send({ version: 1, cases: [{ mode: 'bulk' }] }).expect(400)
  })

  it('accepts bodies larger than the global 100kb json limit', async () => {
    const big = bulkCase('big')
    big.bulkItems = Array.from({ length: 2000 }, (_, i) => ({ id: String(i), method: 'POST', path: '/esb_api/pull/pull-sales-data', body: { pad: 'x'.repeat(100) }, headers: {} }))
    await request(app).post('/api/cases/inbox').send({ version: 1, cases: [big] }).expect(201)
  })
})
