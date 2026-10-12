import React, { useRef, useState } from 'react'
import JSZip from 'jszip'
import { Download, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import type { ExportedMock, MockImportResult } from '@mintara/shared'
import { Button } from '../../../components_ui/ui/button'
import { Input } from '../../../components_ui/ui/input'
import { Checkbox } from '../../../components_ui/ui/checkbox'
import { Separator } from '../../../components_ui/ui/separator'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components_ui/ui/dialog'
import { useMockWebhookStore } from '../store'
import { buildExport, exportFileName, findConflicts, parseMocksFile, toExportedMock } from '../mockTransfer'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function summarize(r: MockImportResult): string {
  const imported = r.created.length + r.overwritten.length
  const parts = [`Imported ${imported} mock${imported !== 1 ? 's' : ''}`]
  const detail: string[] = []
  if (r.overwritten.length) detail.push(`${r.overwritten.length} overwritten`)
  if (r.skipped.length) detail.push(`${r.skipped.length} skipped`)
  if (detail.length) parts.push(`(${detail.join(', ')})`)
  return parts.join(' ')
}

export function MockSlugList() {
  const { mocks, selectedSlug, select, create, rename, remove, importMocks } = useMockWebhookStore()
  const [newSlug, setNewSlug] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<ExportedMock[]>([])
  const [conflicts, setConflicts] = useState<ExportedMock[]>([])
  const [resolutions, setResolutions] = useState<Record<string, 'overwrite' | 'skip'>>({})

  // Export/selection state
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSlug.trim()) return
    if (await create(newSlug.trim())) setNewSlug('')
  }

  const commitRename = async () => {
    if (renaming === null) return
    const error = await rename(renaming, renameValue.trim())
    if (error) {
      setRenameError(error)
      return
    }
    setRenaming(null)
    setRenameError(null)
  }

  // --- Export ---
  const exitSelecting = () => {
    setIsSelecting(false)
    setSelectedNames(new Set())
  }

  const toggleSelected = (slug: string) =>
    setSelectedNames((s) => {
      const next = new Set(s)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })

  const handleExport = async () => {
    const toExport = mocks.filter((m) => selectedNames.has(m.slug)).map(toExportedMock)
    const exportedAt = new Date().toISOString()

    if (toExport.length === 1) {
      const payload = buildExport(toExport, exportedAt)
      download(
        new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
        exportFileName(toExport[0]!.slug, new Set()),
      )
      exitSelecting()
      return
    }

    setIsExporting(true)
    try {
      const zip = new JSZip()
      const used = new Set<string>()
      for (const m of toExport) {
        zip.file(exportFileName(m.slug, used), JSON.stringify(buildExport([m], exportedAt), null, 2))
      }
      download(await zip.generateAsync({ type: 'blob' }), 'mintara-mocks.zip')
    } finally {
      setIsExporting(false)
      exitSelecting()
    }
  }

  // --- Import ---
  const resetImportState = () => {
    setImportError(null)
    setImportSummary(null)
    setPendingImport([])
    setConflicts([])
    setResolutions({})
  }

  const runImport = async (incoming: ExportedMock[], res: Record<string, 'overwrite' | 'skip'>) => {
    const result = await importMocks(incoming, res)
    if (!result) return
    setImportSummary(summarize(result))
    if (result.errors.length) {
      setImportError(result.errors.map((e) => `${e.slug || '(no slug)'}: ${e.error}`).join('; '))
    }
  }

  const applyIncoming = async (incoming: ExportedMock[]) => {
    if (incoming.length === 0) {
      setImportError('No mocks found in file')
      return
    }
    const conflicting = findConflicts(incoming, mocks)
    if (conflicting.length === 0) {
      await runImport(incoming, {})
      return
    }
    setPendingImport(incoming)
    setConflicts(conflicting)
    setResolutions(Object.fromEntries(conflicting.map((c) => [c.slug, 'skip' as const])))
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    resetImportState()

    if (file.name.toLowerCase().endsWith('.zip')) {
      try {
        const zip = await JSZip.loadAsync(await file.arrayBuffer())
        const entries = Object.values(zip.files).filter((f) => !f.dir && f.name.toLowerCase().endsWith('.json'))
        const incoming: ExportedMock[] = []
        for (const entry of entries) {
          try {
            incoming.push(...(parseMocksFile(JSON.parse(await entry.async('string'))) ?? []))
          } catch {
            // skip unreadable entries in the zip
          }
        }
        if (incoming.length === 0) setImportError('Invalid format — no valid mintara mock files found in zip')
        else await applyIncoming(incoming)
      } catch {
        setImportError('Invalid file — could not read zip')
      }
      return
    }

    try {
      const parsed = parseMocksFile(JSON.parse(await file.text()))
      if (!parsed) {
        setImportError('Invalid format — not a mintara mock export')
        return
      }
      await applyIncoming(parsed)
    } catch {
      setImportError('Invalid file — could not parse JSON')
    }
  }

  const handleConfirmImport = async () => {
    const incoming = pendingImport
    const res = resolutions
    setPendingImport([])
    setConflicts([])
    setResolutions({})
    await runImport(incoming, res)
  }

  const isConflictView = conflicts.length > 0

  return (
    <div className="flex flex-col bg-white border-l border-slate-200 w-64 shrink-0 h-full overflow-hidden">
      <div className="px-3 py-3 border-b border-slate-100 shrink-0">
        <span className="text-sm font-semibold text-slate-700">Mocks</span>
      </div>

      {isConflictView ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          <p className="text-xs text-slate-600">The following mocks already exist:</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {conflicts.map((c) => (
              <div key={c.slug} className="flex items-center justify-between p-2 rounded border border-slate-200">
                <p className="text-xs font-mono font-medium truncate mr-2">{c.slug}</p>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant={resolutions[c.slug] === 'overwrite' ? 'default' : 'outline'}
                    className="h-6 px-2 text-xs"
                    onClick={() => setResolutions((r) => ({ ...r, [c.slug]: 'overwrite' }))}
                  >
                    Overwrite
                  </Button>
                  <Button
                    size="sm"
                    variant={resolutions[c.slug] === 'skip' ? 'default' : 'outline'}
                    className="h-6 px-2 text-xs"
                    onClick={() => setResolutions((r) => ({ ...r, [c.slug]: 'skip' }))}
                  >
                    Skip
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setPendingImport([])
                setConflicts([])
                setResolutions({})
              }}
            >
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleConfirmImport}>
              Confirm
            </Button>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={submitNew} className="flex gap-1 p-2 shrink-0">
            <Input
              className="h-8 text-xs"
              placeholder="new-slug"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
            />
            <Button type="submit" size="sm" className="h-8 px-2" title="Create mock">
              <Plus className="h-4 w-4" />
            </Button>
          </form>

          <Separator />

          <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
            {mocks.length === 0 && <p className="text-xs text-slate-400 px-1 py-2">No mocks yet.</p>}
            {mocks.map((m) =>
              renaming === m.slug ? (
                <div key={m.slug} className="space-y-1 p-1">
                  <Input
                    autoFocus
                    className="h-7 text-xs"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value.toLowerCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    onBlur={() => setRenaming(null)}
                  />
                  {renameError && <p className="text-xs text-red-500">{renameError}</p>}
                </div>
              ) : (
                <div
                  key={m.slug}
                  onClick={() => (isSelecting ? toggleSelected(m.slug) : select(m.slug))}
                  className={`group flex items-center gap-1 px-2 py-1.5 rounded-md text-sm cursor-pointer ${
                    !isSelecting && selectedSlug === m.slug ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {isSelecting && (
                    <Checkbox
                      checked={selectedNames.has(m.slug)}
                      onCheckedChange={() => toggleSelected(m.slug)}
                      onClick={(e) => e.stopPropagation()}
                      className="mr-1 shrink-0"
                    />
                  )}
                  <span className="flex-1 truncate font-mono text-xs">{m.slug}</span>
                  <span className="text-[10px] opacity-60">{m.rules.length} rules</span>
                  {!isSelecting && (
                    <>
                      <button
                        type="button"
                        className="p-0.5 opacity-0 group-hover:opacity-100"
                        title="Rename"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenaming(m.slug)
                          setRenameValue(m.slug)
                          setRenameError(null)
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="p-0.5 opacity-0 group-hover:opacity-100"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPendingDelete(m.slug)
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              ),
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 shrink-0">
            {!isSelecting ? (
              <>
                <input ref={fileInputRef} type="file" accept=".json,.zip" className="hidden" onChange={handleFileChange} />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => {
                    resetImportState()
                    fileInputRef.current?.click()
                  }}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" /> Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2"
                  disabled={mocks.length === 0}
                  onClick={() => {
                    setImportSummary(null)
                    setImportError(null)
                    setIsSelecting(true)
                  }}
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> Export
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={exitSelecting}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs px-2"
                  disabled={selectedNames.size === 0 || isExporting}
                  onClick={handleExport}
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> {isExporting ? 'Zipping…' : `Export (${selectedNames.size})`}
                </Button>
              </>
            )}
          </div>
          {importError && <p className="text-xs text-red-500 px-3 pb-1">{importError}</p>}
          {importSummary && <p className="text-xs text-green-600 px-3 pb-1">{importSummary}</p>}
        </>
      )}

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete mock "{pendingDelete}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Its rules and request log are removed. Callers hitting this URL will get a 404.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (pendingDelete) await remove(pendingDelete)
                setPendingDelete(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
