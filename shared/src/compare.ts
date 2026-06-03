import type { DiffNode } from './types.js'

/**
 * Iteratively diff two normalized JSON values.
 * Returns a flat DiffNode[] — only non-equal nodes are included.
 * Call normalize() on both inputs before calling compare() if you want
 * field ignoring / array sorting / float tolerance applied.
 */
export function compare(a: unknown, b: unknown, path: string): DiffNode[] {
  const nodes: DiffNode[] = []
  const seen = new Map<unknown, unknown>()
  const stack: Array<{ a: unknown; b: unknown; path: string }> = [{ a, b, path }]

  while (stack.length > 0) {
    const { a, b, path } = stack.pop()!

    if (a === b) continue

    const aIsArray = Array.isArray(a)
    const bIsArray = Array.isArray(b)
    const aIsObj = isPlainObject(a)
    const bIsObj = isPlainObject(b)

    if (aIsObj && bIsObj) {
      const prevB = seen.get(a)
      if (prevB !== undefined && prevB === b) continue
      seen.set(a, b)

      const aObj = a as Record<string, unknown>
      const bObj = b as Record<string, unknown>
      const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)])

      for (const key of allKeys) {
        const childPath = path ? `${path}.${key}` : key
        const aHas = Object.prototype.hasOwnProperty.call(aObj, key)
        const bHas = Object.prototype.hasOwnProperty.call(bObj, key)

        if (aHas && !bHas) {
          nodes.push({ path: childPath, status: 'removed', valueA: aObj[key], valueB: undefined })
        } else if (!aHas && bHas) {
          nodes.push({ path: childPath, status: 'added', valueA: undefined, valueB: bObj[key] })
        } else {
          stack.push({ a: aObj[key], b: bObj[key], path: childPath })
        }
      }
      continue
    }

    if (aIsArray && bIsArray) {
      const aArr = a as unknown[]
      const bArr = b as unknown[]
      const maxLen = Math.max(aArr.length, bArr.length)

      for (let i = 0; i < maxLen; i++) {
        const childPath = `${path}[${i}]`
        if (i >= aArr.length) {
          nodes.push({ path: childPath, status: 'added', valueA: undefined, valueB: bArr[i] })
        } else if (i >= bArr.length) {
          nodes.push({ path: childPath, status: 'removed', valueA: aArr[i], valueB: undefined })
        } else {
          stack.push({ a: aArr[i], b: bArr[i], path: childPath })
        }
      }
      continue
    }

    nodes.push({ path, status: 'changed', valueA: a, valueB: b })
  }

  return nodes
}

function isPlainObject(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
