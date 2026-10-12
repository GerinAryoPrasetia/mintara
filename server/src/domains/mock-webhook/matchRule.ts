import type { MockRule, MockSlug } from '@mintara/shared'

export type MatchResult =
  | { kind: 'rule'; rule: MockRule }
  | { kind: 'default' }
  | { kind: 'unknown-slug' }

/** Drops the query, ensures a leading '/', trims a trailing '/' (except on root). */
export function normalizeSubPath(subPath: string): string {
  let p = subPath.split('?')[0] ?? ''
  if (!p.startsWith('/')) p = `/${p}`
  if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '') || '/'
  return p
}

function pathMatches(pattern: string, subPath: string): boolean {
  const normalized = normalizeSubPath(pattern)
  if (!normalized.includes('*')) return normalized === subPath
  // '*' matches any run of characters, '/' included; everything else is literal
  const source = normalized
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${source}$`).test(subPath)
}

/**
 * Picks the response source for one incoming call: the first rule whose
 * method and sub-path match, else the slug's default, else unknown-slug.
 */
export function matchRule(mock: MockSlug | undefined, method: string, subPath: string): MatchResult {
  if (!mock) return { kind: 'unknown-slug' }
  const m = method.toUpperCase()
  const p = normalizeSubPath(subPath)
  const rule = mock.rules.find(
    (r) => (r.method === 'ANY' || r.method.toUpperCase() === m) && pathMatches(r.path, p),
  )
  return rule ? { kind: 'rule', rule } : { kind: 'default' }
}
