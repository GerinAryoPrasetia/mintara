import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createMockStore } from './mockStore.js'
import { createRequestLog } from './requestLog.js'
import { createHookRouter } from './hookRoutes.js'
import { createMockAdminRouter } from './routes.js'

// Mirrors the wiring order in server/src/index.ts: /hook before express.json()
function buildApp() {
  const store = createMockStore(null)
  const log = createRequestLog()
  const app = express()
  app.use('/hook', createHookRouter({ store, log }))
  app.use(express.json())
  app.use('/api', createMockAdminRouter({ store, log, port: 3001 }))
  return app
}

describe('mock webhook routes', () => {
  let app: express.Express

  beforeEach(() => {
    app = buildApp()
  })

  it('serves the configured rule and records the call', async () => {
    await request(app).post('/api/mocks').send({ slug: 'voucher' }).expect(201)
    await request(app)
      .put('/api/mocks/voucher')
      .send({
        rules: [
          {
            method: 'POST',
            path: '/burn',
            response: { status: 202, headers: { 'Content-Type': 'application/json' }, body: '{"status":"success","code":"{{body.voucherCodes.0}}"}' },
          },
        ],
      })
      .expect(200)

    const res = await request(app).post('/hook/voucher/burn?branch=JKT').send({ voucherCodes: ['A1'] })
    expect(res.status).toBe(202)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.body).toEqual({ status: 'success', code: 'A1' })

    const logRes = await request(app).get('/api/mocks/voucher/requests').expect(200)
    expect(logRes.body).toHaveLength(1)
    expect(logRes.body[0]).toMatchObject({
      method: 'POST',
      path: '/hook/voucher/burn?branch=JKT',
      subPath: '/burn',
      query: { branch: 'JKT' },
      jsonBody: { voucherCodes: ['A1'] },
      response: { status: 202, matched: 'rule' },
    })
  })

  it('falls back to the default response for an unmatched sub-path', async () => {
    await request(app).post('/api/mocks').send({ slug: 'voucher' }).expect(201)
    const res = await request(app).get('/hook/voucher/validate-voucher')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'success' })
  })

  it('imports mocks: creates new slugs, overwrites or skips existing ones per resolution', async () => {
    await request(app).post('/api/mocks').send({ slug: 'keep' }).expect(201)
    await request(app).post('/api/mocks').send({ slug: 'replace' }).expect(201)
    const rule = { id: 'r1', method: 'POST', path: '/burn', response: { status: 201, headers: {}, body: '{"status":"success"}' } }
    const dflt = { status: 200, headers: {}, body: '{}' }

    const res = await request(app)
      .post('/api/mocks/import')
      .send({
        mocks: [
          { slug: 'fresh', rules: [rule], defaultResponse: dflt },
          { slug: 'keep', rules: [rule], defaultResponse: dflt },
          { slug: 'replace', rules: [rule], defaultResponse: dflt },
          { slug: 'Bad Slug', rules: [], defaultResponse: dflt },
        ],
        resolutions: { replace: 'overwrite' },
      })
      .expect(200)

    expect(res.body).toMatchObject({ created: ['fresh'], overwritten: ['replace'], skipped: ['keep'] })
    expect(res.body.errors).toHaveLength(1)
    expect((await request(app).post('/hook/fresh/burn')).status).toBe(201)
    expect((await request(app).post('/hook/replace/burn')).status).toBe(201)
    expect((await request(app).post('/hook/keep/burn')).status).toBe(200)
  })

  it('captures a non-JSON body raw', async () => {
    await request(app).post('/api/mocks').send({ slug: 'billing' }).expect(201)
    await request(app).post('/hook/billing').set('Content-Type', 'text/plain').send('a=1&b=<x>').expect(200)

    const [entry] = (await request(app).get('/api/mocks/billing/requests')).body
    expect(entry).toMatchObject({ rawBody: 'a=1&b=<x>', jsonBody: null, subPath: '/' })
  })

  it('replies 404 for an unknown slug and still records the call', async () => {
    const res = await request(app).post('/hook/nope/x').send({ a: 1 })
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'unknown mock slug' })

    const logRes = await request(app).get('/api/mocks/nope/requests')
    expect(logRes.body[0]).toMatchObject({ response: { matched: 'unknown-slug', status: 404 } })
  })

  it('clears one log and all logs', async () => {
    await request(app).get('/hook/a/x')
    await request(app).get('/hook/b/x')
    await request(app).delete('/api/mocks/a/requests').expect(204)
    expect((await request(app).get('/api/mocks/a/requests')).body).toEqual([])
    expect((await request(app).get('/api/mocks/b/requests')).body).toHaveLength(1)
    await request(app).delete('/api/mocks/requests').expect(204)
    expect((await request(app).get('/api/mocks/b/requests')).body).toEqual([])
  })

  it('moves the log along with a rename', async () => {
    await request(app).post('/api/mocks').send({ slug: 'old' }).expect(201)
    await request(app).get('/hook/old/x')
    await request(app).post('/api/mocks/old/rename').send({ newSlug: 'new' }).expect(200)
    expect((await request(app).get('/api/mocks/new/requests')).body).toHaveLength(1)
    expect((await request(app).get('/hook/new/x')).status).toBe(200)
  })
})
