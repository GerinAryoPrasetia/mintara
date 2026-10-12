import { existsSync, mkdirSync, readFileSync, renameSync } from 'fs'
import { mkdir, rename, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { randomUUID } from 'crypto'
import type { MockMethod, MockResponse, MockRule, MockSlug } from '@mintara/shared'
import { defaultMockResponse, JSON_HEADERS } from './defaults.js'

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const METHODS: MockMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'ANY']
const MAX_DELAY_MS = 120_000

export class MockStoreError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function sanitizeResponse(input: unknown): MockResponse {
  const r = (input ?? {}) as Partial<MockResponse>
  const status = Number.isInteger(r.status) && r.status! >= 100 && r.status! <= 599 ? r.status! : 200
  const headers: Record<string, string> = {}
  if (r.headers && typeof r.headers === 'object') {
    for (const [k, v] of Object.entries(r.headers)) if (k.trim()) headers[k.trim()] = String(v)
  }
  const response: MockResponse = {
    status,
    headers: Object.keys(headers).length > 0 ? headers : { ...JSON_HEADERS },
    body: typeof r.body === 'string' ? r.body : '',
  }
  const delay = Number(r.delayMs)
  if (Number.isFinite(delay) && delay > 0) response.delayMs = Math.min(Math.floor(delay), MAX_DELAY_MS)
  return response
}

function sanitizeRule(input: unknown): MockRule {
  const r = (input ?? {}) as Partial<MockRule>
  const method = METHODS.includes(String(r.method).toUpperCase() as MockMethod)
    ? (String(r.method).toUpperCase() as MockMethod)
    : 'ANY'
  return {
    id: typeof r.id === 'string' && r.id ? r.id : randomUUID(),
    method,
    path: typeof r.path === 'string' && r.path.trim() ? r.path.trim() : '/*',
    response: sanitizeResponse(r.response),
  }
}

function assertSlug(slug: string) {
  if (!SLUG_PATTERN.test(slug)) {
    throw new MockStoreError('slug must be lowercase letters, digits, "-" or "_" (max 64 chars)', 400)
  }
}

/**
 * Mock definitions keyed by slug. Persisted to `filePath` as JSON with an
 * atomic tmp-file + rename; `filePath = null` keeps everything in memory.
 */
export function createMockStore(filePath: string | null) {
  const mocks = new Map<string, MockSlug>()

  if (filePath && existsSync(filePath)) {
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as { mocks?: MockSlug[] }
      for (const m of parsed.mocks ?? []) {
        if (typeof m?.slug === 'string' && SLUG_PATTERN.test(m.slug)) mocks.set(m.slug, m)
      }
    } catch {
      // Keep the unreadable file around rather than overwrite it on the next save
      const backup = `${filePath}.corrupt-${Date.now()}`
      renameSync(filePath, backup)
      console.warn(`[mock-webhook] could not parse mocks file; moved it to ${backup}`)
    }
  }

  let writing: Promise<void> = Promise.resolve()
  const persist = (): Promise<void> => {
    if (!filePath) return Promise.resolve()
    const data = JSON.stringify({ version: 1, mocks: [...mocks.values()] }, null, 2)
    writing = writing
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(filePath), { recursive: true })
        const tmp = `${filePath}.tmp`
        await writeFile(tmp, data, 'utf8')
        await rename(tmp, filePath)
      })
    return writing
  }

  if (filePath) mkdirSync(dirname(filePath), { recursive: true })

  return {
    list(): MockSlug[] {
      return [...mocks.values()].sort((a, b) => a.slug.localeCompare(b.slug))
    },
    get(slug: string): MockSlug | undefined {
      return mocks.get(slug)
    },
    async create(slug: string, seed?: { rules?: unknown[]; defaultResponse?: unknown }): Promise<MockSlug> {
      assertSlug(slug)
      if (mocks.has(slug)) throw new MockStoreError(`mock "${slug}" already exists`, 409)
      const now = new Date().toISOString()
      const mock: MockSlug = {
        slug,
        rules: (seed?.rules ?? []).map(sanitizeRule),
        defaultResponse: seed?.defaultResponse ? sanitizeResponse(seed.defaultResponse) : defaultMockResponse(),
        createdAt: now,
        updatedAt: now,
      }
      mocks.set(slug, mock)
      await persist()
      return mock
    },
    async update(slug: string, patch: { rules?: unknown; defaultResponse?: unknown }): Promise<MockSlug> {
      const existing = mocks.get(slug)
      if (!existing) throw new MockStoreError(`mock "${slug}" not found`, 404)
      const mock: MockSlug = {
        ...existing,
        rules: Array.isArray(patch.rules) ? patch.rules.map(sanitizeRule) : existing.rules,
        defaultResponse:
          patch.defaultResponse !== undefined ? sanitizeResponse(patch.defaultResponse) : existing.defaultResponse,
        updatedAt: new Date().toISOString(),
      }
      mocks.set(slug, mock)
      await persist()
      return mock
    },
    async rename(oldSlug: string, newSlug: string): Promise<MockSlug> {
      const existing = mocks.get(oldSlug)
      if (!existing) throw new MockStoreError(`mock "${oldSlug}" not found`, 404)
      assertSlug(newSlug)
      if (newSlug === oldSlug) return existing
      if (mocks.has(newSlug)) throw new MockStoreError(`mock "${newSlug}" already exists`, 409)
      const mock = { ...existing, slug: newSlug, updatedAt: new Date().toISOString() }
      mocks.delete(oldSlug)
      mocks.set(newSlug, mock)
      await persist()
      return mock
    },
    async remove(slug: string): Promise<boolean> {
      const existed = mocks.delete(slug)
      if (existed) await persist()
      return existed
    },
  }
}

export type MockStore = ReturnType<typeof createMockStore>
