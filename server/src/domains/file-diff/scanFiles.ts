import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type { FileMatch, RootScanWarning } from '@mintara/shared'

export const IGNORED_DIRS = new Set(['.git', 'node_modules', 'vendor', 'graphify-out'])
export const MAX_CONTENT_BYTES = 5 * 1024 * 1024 // per-file content cap
export const MAX_FILES_SCANNED = 50000 // per-root walk cap
export const MAX_MATCHES_PER_FILENAME = 20 // per-filename cap, per root

export async function statSafe(p: string) {
  try {
    return await fs.stat(p)
  } catch {
    return null
  }
}

export function matchesRequested(requested: string, relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join('/')
  if (requested.includes('/') || requested.includes(path.sep)) {
    const normalizedRequested = requested.split(path.sep).join('/')
    return normalized === normalizedRequested || normalized.endsWith('/' + normalizedRequested)
  }
  return path.basename(normalized) === requested
}

export async function scanRoot(
  root: string,
  filenames: string[],
  warnings: RootScanWarning[],
  label: 'original' | 'modified',
): Promise<Map<string, FileMatch[]>> {
  const hits = new Map<string, FileMatch[]>(filenames.map((f) => [f, []]))
  let filesScanned = 0
  let capWarned = false

  async function walk(dir: string): Promise<void> {
    if (filesScanned >= MAX_FILES_SCANNED) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (filesScanned >= MAX_FILES_SCANNED) {
        if (!capWarned) {
          capWarned = true
          warnings.push({
            root: label,
            message: `Scan stopped after ${MAX_FILES_SCANNED} files — results may be incomplete`,
          })
        }
        return
      }
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue
        await walk(fullPath)
      } else if (entry.isFile()) {
        filesScanned++
        const relativePath = path.relative(root, fullPath).split(path.sep).join('/')
        for (const filename of filenames) {
          const list = hits.get(filename)!
          if (list.length >= MAX_MATCHES_PER_FILENAME) continue
          if (matchesRequested(filename, relativePath)) {
            try {
              const stat = await fs.stat(fullPath)
              const buf = await fs.readFile(fullPath)
              const truncated = buf.length > MAX_CONTENT_BYTES
              const content = (truncated ? buf.subarray(0, MAX_CONTENT_BYTES) : buf).toString('utf-8')
              list.push({ relativePath, content, sizeBytes: stat.size, truncated })
            } catch {
              list.push({ relativePath, content: '', sizeBytes: 0, truncated: true })
            }
          }
        }
      }
    }
  }

  await walk(root)
  return hits
}
