import { Router } from 'express'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type {
  FileFindRequest,
  FileFindResponse,
  FileFindEntry,
  FileMatch,
  RootScanWarning,
} from '@mintara/shared'

export const filesRouter = Router()

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'vendor', 'graphify-out'])
const MAX_CONTENT_BYTES = 5 * 1024 * 1024 // per-file content cap
const MAX_FILES_SCANNED = 50000 // per-root walk cap
const MAX_MATCHES_PER_FILENAME = 20 // per-filename cap, per root

async function statSafe(p: string) {
  try {
    return await fs.stat(p)
  } catch {
    return null
  }
}

function matchesRequested(requested: string, relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join('/')
  if (requested.includes('/') || requested.includes(path.sep)) {
    const normalizedRequested = requested.split(path.sep).join('/')
    return normalized === normalizedRequested || normalized.endsWith('/' + normalizedRequested)
  }
  return path.basename(normalized) === requested
}

async function scanRoot(
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

filesRouter.post('/files/find', async (req, res) => {
  const body = req.body as Partial<FileFindRequest>

  if (!body.originalRoot || typeof body.originalRoot !== 'string') {
    res.status(400).json({ error: 'originalRoot is required' })
    return
  }
  if (!body.modifiedRoot || typeof body.modifiedRoot !== 'string') {
    res.status(400).json({ error: 'modifiedRoot is required' })
    return
  }
  if (!Array.isArray(body.filenames) || body.filenames.length === 0) {
    res.status(400).json({ error: 'At least one filename is required' })
    return
  }

  const filenames = [...new Set(body.filenames.map((f) => f.trim()).filter(Boolean))]
  if (filenames.length === 0) {
    res.status(400).json({ error: 'At least one filename is required' })
    return
  }

  for (const [label, root] of [
    ['originalRoot', body.originalRoot],
    ['modifiedRoot', body.modifiedRoot],
  ] as const) {
    const stat = await statSafe(root)
    if (!stat) {
      res.status(400).json({ error: `${label} does not exist: ${root}` })
      return
    }
    if (!stat.isDirectory()) {
      res.status(400).json({ error: `${label} is not a directory: ${root}` })
      return
    }
  }

  const warnings: RootScanWarning[] = []
  const [originalHits, modifiedHits] = await Promise.all([
    scanRoot(body.originalRoot, filenames, warnings, 'original'),
    scanRoot(body.modifiedRoot, filenames, warnings, 'modified'),
  ])

  const entries: FileFindEntry[] = filenames.map((filename) => ({
    filename,
    originalMatches: originalHits.get(filename) ?? [],
    modifiedMatches: modifiedHits.get(filename) ?? [],
  }))

  const response: FileFindResponse = { entries, warnings }
  res.json(response)
})
