import type { DiffNode } from './types.js'

/**
 * Recursively diff two normalized JSON values.
 * Returns a flat DiffNode[] — only non-equal nodes are included.
 * Call normalize() on both inputs before calling compare() if you want
 * field ignoring / array sorting / float tolerance applied.
 */
export function compare(a: unknown, b: unknown, path: string): DiffNode[] {
  // Identical by reference or value → no diff
  if (a === b) return []

  const aIsArray = Array.isArray(a)
  const bIsArray = Array.isArray(b)
  const aIsObj = isPlainObject(a)
  const bIsObj = isPlainObject(b)

  // Both arrays
  if (aIsArray && bIsArray) {
    return diffArrays(a as unknown[], b as unknown[], path)
  }

  // Both plain objects
  if (aIsObj && bIsObj) {
    return diffObjects(a as Record<string, unknown>, b as Record<string, unknown>, path)
  }

  // Primitive changed (or type mismatch: one is array/obj, other is not)
  return [{ path, status: 'changed', valueA: a, valueB: b }]
}

function diffObjects(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  path: string,
): DiffNode[] {
  const nodes: DiffNode[] = []
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])

  for (const key of allKeys) {
    const childPath = path ? `${path}.${key}` : key
    const aHas = Object.prototype.hasOwnProperty.call(a, key)
    const bHas = Object.prototype.hasOwnProperty.call(b, key)

    if (aHas && !bHas) {
      nodes.push({ path: childPath, status: 'removed', valueA: a[key], valueB: undefined })
    } else if (!aHas && bHas) {
      nodes.push({ path: childPath, status: 'added', valueA: undefined, valueB: b[key] })
    } else {
      nodes.push(...compare(a[key], b[key], childPath))
    }
  }
  return nodes
}

function diffArrays(a: unknown[], b: unknown[], path: string): DiffNode[] {
  const nodes: DiffNode[] = []
  const maxLen = Math.max(a.length, b.length)

  for (let i = 0; i < maxLen; i++) {
    const childPath = `${path}[${i}]`
    if (i >= a.length) {
      // B has extra element
      nodes.push({ path: childPath, status: 'added', valueA: undefined, valueB: b[i] })
    } else if (i >= b.length) {
      // A has extra element
      nodes.push({ path: childPath, status: 'removed', valueA: a[i], valueB: undefined })
    } else {
      nodes.push(...compare(a[i], b[i], childPath))
    }
  }
  return nodes
}

function isPlainObject(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
