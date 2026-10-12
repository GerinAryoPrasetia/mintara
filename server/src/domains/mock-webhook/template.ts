import { randomUUID } from 'crypto'

export interface TemplateContext {
  body: unknown
  query: Record<string, unknown>
  headers: Record<string, unknown>
}

function walk(value: unknown, segments: string[], caseInsensitive: boolean): unknown {
  let current = value
  for (const seg of segments) {
    if (current === null || typeof current !== 'object') return undefined
    const obj = current as Record<string, unknown>
    if (caseInsensitive) {
      const key = Object.keys(obj).find((k) => k.toLowerCase() === seg.toLowerCase())
      current = key === undefined ? undefined : obj[key]
    } else {
      current = obj[seg]
    }
  }
  return current
}

function resolve(expr: string, ctx: TemplateContext): unknown {
  if (expr === 'uuid') return randomUUID()
  if (expr === 'now') return new Date().toISOString()
  if (expr === 'timestamp') return Date.now()
  const [root, ...rest] = expr.split('.')
  if (root === 'body') return walk(ctx.body, rest, false)
  if (root === 'query') return walk(ctx.query, rest, false)
  if (root === 'headers') return walk(ctx.headers, rest, true)
  return undefined
}

/**
 * Fills `{{ expr }}` placeholders from the incoming request: `body.a.0`,
 * `query.x`, `headers.x-y`, `uuid`, `now`, `timestamp`. Strings are inserted
 * as-is (no JSON escaping), other values JSON-stringified, unresolved → ''.
 */
export function renderTemplate(template: string, ctx: TemplateContext): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, expr: string) => {
    const value = resolve(expr, ctx)
    if (value === undefined || value === null) return ''
    return typeof value === 'string' ? value : JSON.stringify(value)
  })
}
