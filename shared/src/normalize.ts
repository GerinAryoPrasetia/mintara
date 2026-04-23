import type { NormalizationOptions } from './types.js'

/**
 * Normalize a parsed JSON value before comparison.
 * - Strips fields listed in ignoreFields (exact dot-notation path match)
 * - Optionally sorts arrays by JSON.stringify of each element
 */
export function normalize(value: unknown, opts: NormalizationOptions, _path = ''): unknown {
  if (value === null || value === undefined) return value

  if (Array.isArray(value)) {
    let arr = value.map((item) => normalize(item, opts, _path))
    if (opts.sortArrays) {
      arr = [...arr].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    }
    return arr
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(obj)) {
      const fieldPath = _path ? `${_path}.${key}` : key
      if (opts.ignoreFields.includes(fieldPath)) continue
      result[key] = normalize(obj[key], opts, fieldPath)
    }
    return result
  }

  return value
}
