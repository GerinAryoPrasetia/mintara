// Hop-by-hop or recomputed-by-curl headers that would make a replay misbehave
const SKIP_HEADERS = new Set(['host', 'content-length', 'connection', 'accept-encoding'])

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

/**
 * cURL for replaying a recorded call. Unlike api-diff's buildCurl, the body
 * is the raw text exactly as received (never re-stringified) and is sent for
 * any method that carried one.
 */
export function buildRawCurl(
  method: string,
  url: string,
  headers: Record<string, string | string[]>,
  rawBody: string,
): string {
  const parts: string[] = [`curl -X ${method.toUpperCase()} ${quote(url)}`]
  for (const [key, value] of Object.entries(headers)) {
    if (SKIP_HEADERS.has(key.toLowerCase())) continue
    for (const v of Array.isArray(value) ? value : [value]) parts.push(`  -H ${quote(`${key}: ${v}`)}`)
  }
  if (rawBody) parts.push(`  --data-raw ${quote(rawBody)}`)
  return parts.join(' \\\n')
}
