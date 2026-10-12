import type { ExportedMock, MockSlug, MocksExport } from '@mintara/shared'

export const MOCKS_EXPORT_KIND = 'mintara-mocks'
export const MOCKS_EXPORT_VERSION = 1

export function toExportedMock(mock: MockSlug): ExportedMock {
  return { slug: mock.slug, rules: mock.rules, defaultResponse: mock.defaultResponse }
}

export function buildExport(mocks: ExportedMock[], exportedAt = new Date().toISOString()): MocksExport {
  return { kind: MOCKS_EXPORT_KIND, version: MOCKS_EXPORT_VERSION, exportedAt, mocks }
}

/** Also accepts a bare array of mocks or a single mock object, for hand-written files. */
export function parseMocksFile(parsed: unknown): ExportedMock[] | null {
  const isMock = (m: unknown): m is ExportedMock =>
    typeof m === 'object' && m !== null && typeof (m as ExportedMock).slug === 'string'

  if (Array.isArray(parsed)) return parsed.every(isMock) ? parsed : null
  if (typeof parsed !== 'object' || parsed === null) return null
  const { kind, version, mocks } = parsed as Partial<MocksExport>
  if (kind === MOCKS_EXPORT_KIND && version === MOCKS_EXPORT_VERSION && Array.isArray(mocks)) {
    return mocks.filter(isMock)
  }
  return isMock(parsed) ? [parsed] : null
}

/** Incoming mocks whose slug already exists — the ones the user must resolve. */
export function findConflicts(incoming: ExportedMock[], existing: MockSlug[]): ExportedMock[] {
  const slugs = new Set(existing.map((m) => m.slug))
  return incoming.filter((m) => slugs.has(m.slug))
}

/** File name for one mock in an export, unique within `used` (mutated). */
export function exportFileName(slug: string, used: Set<string>): string {
  const base = slug.replace(/[^a-zA-Z0-9-_]/g, '-') || 'mock'
  let name = base
  let suffix = 2
  while (used.has(name)) name = `${base}-${suffix++}`
  used.add(name)
  return `${name}.json`
}
