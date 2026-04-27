import React, { useState, useRef } from 'react'
import { Save, FolderOpen, Trash2, Download, Upload } from 'lucide-react'
import { Button } from '../components_ui/ui/button'
import { Input } from '../components_ui/ui/input'
import { Checkbox } from '../components_ui/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components_ui/ui/dialog'
import { Badge } from '../components_ui/ui/badge'
import { Separator } from '../components_ui/ui/separator'
import { useStore } from '../store'
import type { SavedCase, SavedCasesExport } from '../store'

export function TestCaseManager() {
  const { savedCases, saveCase, loadCase, deleteCase, importCases } = useStore()
  const [saveName, setSaveName] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [loadOpen, setLoadOpen] = useState(false)

  // Selection / export state
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<SavedCase[]>([])
  const [conflicts, setConflicts] = useState<SavedCase[]>([])
  const [resolutions, setResolutions] = useState<Record<string, 'overwrite' | 'skip'>>({})

  const handleSave = () => {
    const trimmed = saveName.trim()
    if (!trimmed) return
    saveCase(trimmed)
    setSaveName('')
    setSaveOpen(false)
  }

  const handleLoad = (name: string) => {
    loadCase(name)
    setLoadOpen(false)
  }

  // --- Selection helpers ---
  const allSelected = savedCases.length > 0 && selectedNames.size === savedCases.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedNames(new Set())
    } else {
      setSelectedNames(new Set(savedCases.map((c) => c.name)))
    }
  }

  const toggleSelect = (name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const exitSelecting = () => {
    setIsSelecting(false)
    setSelectedNames(new Set())
  }

  // --- Export ---
  const handleExport = () => {
    const toExport = savedCases.filter((c) => selectedNames.has(c.name))
    const payload: SavedCasesExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      cases: toExport,
    }
    const filename =
      toExport.length === 1
        ? `${toExport[0].name.replace(/[^a-zA-Z0-9-_]/g, '-')}.json`
        : 'mintara-test-cases.json'
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    exitSelecting()
  }

  // --- Import ---
  const resetImportState = () => {
    setImportError(null)
    setImportSummary(null)
    setPendingImport([])
    setConflicts([])
    setResolutions({})
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    resetImportState()

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        if (parsed.version !== 1 || !Array.isArray(parsed.cases)) {
          setImportError('Invalid format — not a Mintara export file')
          return
        }
        const incoming: SavedCase[] = parsed.cases
        if (incoming.length === 0) {
          setImportError('No test cases found in file')
          return
        }
        const conflicting = incoming.filter((c) => savedCases.some((e) => e.name === c.name))
        if (conflicting.length === 0) {
          importCases(incoming, {})
          setImportSummary(`Imported ${incoming.length} case${incoming.length !== 1 ? 's' : ''}`)
        } else {
          setPendingImport(incoming)
          setConflicts(conflicting)
          const defaultRes: Record<string, 'overwrite' | 'skip'> = {}
          conflicting.forEach((c) => { defaultRes[c.name] = 'skip' })
          setResolutions(defaultRes)
        }
      } catch {
        setImportError('Invalid file — could not parse JSON')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleConfirmImport = () => {
    importCases(pendingImport, resolutions)
    const overwritten = Object.values(resolutions).filter((r) => r === 'overwrite').length
    const skipped = Object.values(resolutions).filter((r) => r === 'skip').length
    const newCount = pendingImport.length - conflicts.length
    const total = newCount + overwritten
    setImportSummary(
      `Imported ${total} case${total !== 1 ? 's' : ''} (${overwritten} overwritten, ${skipped} skipped)`
    )
    setPendingImport([])
    setConflicts([])
    setResolutions({})
  }

  const isConflictView = conflicts.length > 0

  return (
    <div className="flex gap-2">
      {/* Save Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Save className="h-4 w-4 mr-1" />
            Save Test Case
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Test Case</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Test case name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <Button onClick={handleSave} disabled={!saveName.trim()}>
              Save
            </Button>
          </div>
          {savedCases.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              Saving with an existing name will overwrite it.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Load / Manage Dialog */}
      <Dialog
        open={loadOpen}
        onOpenChange={(open) => {
          setLoadOpen(open)
          if (!open) {
            exitSelecting()
            resetImportState()
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={savedCases.length === 0}>
            <FolderOpen className="h-4 w-4 mr-1" />
            Load Test Case
            {savedCases.length > 0 && (
              <Badge className="ml-1 bg-slate-100 text-slate-700 text-xs">
                {savedCases.length}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isConflictView ? 'Resolve Conflicts' : 'Load Test Case'}</DialogTitle>
          </DialogHeader>

          {/* Conflict resolution view */}
          {isConflictView ? (
            <div className="mt-2 space-y-3">
              <p className="text-sm text-slate-600">
                The following cases already exist. Choose what to do with each:
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {conflicts.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between p-2 rounded border border-slate-200"
                  >
                    <p className="text-sm font-medium truncate mr-2">{c.name}</p>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant={resolutions[c.name] === 'overwrite' ? 'default' : 'outline'}
                        onClick={() => setResolutions((r) => ({ ...r, [c.name]: 'overwrite' }))}
                      >
                        Overwrite
                      </Button>
                      <Button
                        size="sm"
                        variant={resolutions[c.name] === 'skip' ? 'default' : 'outline'}
                        onClick={() => setResolutions((r) => ({ ...r, [c.name]: 'skip' }))}
                      >
                        Skip
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPendingImport([])
                    setConflicts([])
                    setResolutions({})
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleConfirmImport}>
                  Confirm Import
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Select All (selection mode only) */}
              {isSelecting && savedCases.length > 0 && (
                <div className="flex items-center gap-2 mt-2 pb-1">
                  <Checkbox
                    id="select-all"
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-sm cursor-pointer select-none">
                    Select All
                  </label>
                </div>
              )}

              {/* Case list */}
              <div className="space-y-1 mt-2 max-h-64 overflow-y-auto">
                {savedCases.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No saved test cases.</p>
                ) : (
                  savedCases.map((tc) => (
                    <div key={tc.name}>
                      <div className="flex items-center justify-between p-2 rounded hover:bg-slate-50">
                        {isSelecting && (
                          <Checkbox
                            id={`select-${tc.name}`}
                            checked={selectedNames.has(tc.name)}
                            onCheckedChange={() => toggleSelect(tc.name)}
                            className="mr-2 shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tc.name}</p>
                          <p className="text-xs text-slate-500">
                            {tc.mode === 'bulk'
                              ? `Bulk — ${tc.bulkItems?.length ?? 0} request${(tc.bulkItems?.length ?? 0) !== 1 ? 's' : ''}`
                              : `${tc.config.targets.map((t) => t.name).join(' vs ')} — ${tc.config.method}`}
                          </p>
                        </div>
                        {!isSelecting && (
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="ghost" onClick={() => handleLoad(tc.name)}>
                              Load
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteCase(tc.name)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <Separator />
                    </div>
                  ))
                )}
              </div>

              {/* Status messages */}
              {importError && (
                <p className="text-xs text-red-500 mt-1">{importError}</p>
              )}
              {importSummary && (
                <p className="text-xs text-green-600 mt-1">{importSummary}</p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100">
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetImportState()
                      fileInputRef.current?.click()
                    }}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Import...
                  </Button>
                </div>

                {!isSelecting ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={savedCases.length === 0}
                    onClick={() => {
                      setIsSelecting(true)
                      setImportSummary(null)
                      setImportError(null)
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export...
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exitSelecting}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={selectedNames.size === 0}
                      onClick={handleExport}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export Selected ({selectedNames.size})
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
