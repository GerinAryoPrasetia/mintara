import { Router } from 'express'
import { scanRoot, statSafe } from './scanFiles.js'
import type {
  FileFindRequest,
  FileFindResponse,
  FileFindEntry,
  RootScanWarning,
} from '@mintara/shared'

export const fileDiffRouter = Router()

fileDiffRouter.post('/files/find', async (req, res) => {
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
