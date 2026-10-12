import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createMockStore } from './mockStore.js'

let dir: string

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('createMockStore', () => {
  it('persists atomically and reloads what it wrote', async () => {
    dir = mkdtempSync(join(tmpdir(), 'mintara-mocks-'))
    const file = join(dir, 'nested', 'mocks.json')
    const store = createMockStore(file)
    await store.create('voucher')
    await store.update('voucher', { rules: [{ method: 'post', path: '/burn', response: { status: 201, body: 'ok' } }] })

    expect(readdirSync(join(dir, 'nested'))).toEqual(['mocks.json'])
    const reloaded = createMockStore(file)
    expect(reloaded.get('voucher')?.rules[0]).toMatchObject({
      method: 'POST',
      path: '/burn',
      response: { status: 201, body: 'ok', headers: { 'Content-Type': 'application/json' } },
    })
    expect(JSON.parse(readFileSync(file, 'utf8')).version).toBe(1)
  })

  it('moves a corrupt file aside instead of overwriting it', () => {
    dir = mkdtempSync(join(tmpdir(), 'mintara-mocks-'))
    const file = join(dir, 'mocks.json')
    writeFileSync(file, '{not json')
    const store = createMockStore(file)
    expect(store.list()).toEqual([])
    expect(readdirSync(dir).some((f) => f.startsWith('mocks.json.corrupt-'))).toBe(true)
  })

  it('rejects invalid and duplicate slugs', async () => {
    const store = createMockStore(null)
    await expect(store.create('Bad Slug')).rejects.toMatchObject({ status: 400 })
    await store.create('ok')
    await expect(store.create('ok')).rejects.toMatchObject({ status: 409 })
  })
})
