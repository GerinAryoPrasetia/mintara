import React, { useState, useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus, Copy, Trash2, Download, Upload, Save } from 'lucide-react'
import { Button } from '../components_ui/ui/button'
import { Input } from '../components_ui/ui/input'
import { Checkbox } from '../components_ui/ui/checkbox'
import { Separator } from '../components_ui/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components_ui/ui/dialog'
import { useStore } from '../store'
import type { SavedCase, SavedCasesExport } from '../store'

export function Sidebar() {
  const { savedCases, activeCaseName, switchCase, newCase, duplicateCase, deleteCase, saveCurrentCase } = useStore()
  const [collapsed, setCollapsed] = useState(false)

  // Save dialog state
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<SavedCase[]>([])
  const [conflicts, setConflicts] = useState<SavedCase[]>([])
  const [resolutions, setResolutions] = useState<Record<string, 'overwrite' | 'skip'>>({})

  // Export/selection state
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())

  const handleSave = () => {
    const trimmed = saveName.trim()
    if (!trimmed) return
    saveCurrentCase(trimmed)
    setSaveOpen(false)
  }

  const openSaveDialog = () => {
    setSaveName(activeCaseName ?? '')
    setSaveOpen(true)
  }

  const handleSaveClose = () => {
    setSaveOpen(false)
    setSaveName('')
  }

  const handleSwitch = (name: string) => {
    switchCase(name)
  }

  const handleDuplicate = (e: React.MouseEvent, name: string) => {
    e.stopPropagation()
    duplicateCase(name)
  }

  const handleDelete = (e: React.MouseEvent, name: string) => {
    e.stopPropagation()
    deleteCase(name)
  }

  // --- Selection helpers ---
  const allSelected = savedCases.length > 0 && selectedNames.size === savedCases.length
  const toggleSelectAll = () => {
    if (allSelected) setSelectedNames(new Set())
    else setSelectedNames(new Set(savedCases.map((c) => c.name)))
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
    const payload: SavedCasesExport = { version: 1, exportedAt: new Date().toISOString(), cases: toExport }
    const filename = toExport.length === 1 ? `${toExport[0].name.replace(/[^a-zA-Z0-9-_]/g, '-')}.json` : 'mintara-test-cases.json'
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
        if (incoming.length === 0) { setImportError('No test cases found in file'); return }
        const conflicting = incoming.filter((c) => savedCases.some((e) => e.name === c.name))
        if (conflicting.length === 0) {
          useStore.getState().importCases(incoming, {})
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
    useStore.getState().importCases(pendingImport, resolutions)
    const overwritten = Object.values(resolutions).filter((r) => r === 'overwrite').length
    const skipped = Object.values(resolutions).filter((r) => r === 'skip').length
    const newCount = pendingImport.length - conflicts.length
    setImportSummary(`Imported ${newCount + overwritten} case${newCount + overwritten !== 1 ? 's' : ''} (${overwritten} overwritten, ${skipped} skipped)`)
    setPendingImport([])
    setConflicts([])
    setResolutions({})
  }

  const caseHint = (tc: SavedCase) => {
    if (tc.mode === 'bulk') return `${tc.bulkItems?.length ?? 0} requests`
    return `${tc.config.method} ${tc.config.path || '/'}`
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3 px-1 bg-white border-r border-slate-200 w-8 shrink-0">
        <button
          onClick={() => { setCollapsed(false); setSaveOpen(false) }}
          className="p-1.5 rounded hover:bg-slate-100 mb-2"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4 text-slate-500" />
        </button>
        <button
          onClick={() => newCase()}
          className="p-1.5 rounded hover:bg-slate-100 mb-2"
          title="New test case"
        >
          <Plus className="h-4 w-4 text-slate-500" />
        </button>
        {savedCases.map((tc) => (
          <button
            key={tc.name}
            onClick={() => handleSwitch(tc.name)}
            title={tc.name}
            className={`w-6 h-6 rounded-full mb-1 flex items-center justify-center text-xs font-medium ${
              tc.name === activeCaseName ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {tc.name[0].toUpperCase()}
          </button>
        ))}
      </div>
    )
  }

  const isConflictView = conflicts.length > 0

  return (
    <div className="flex flex-col bg-white border-r border-slate-200 w-56 shrink-0 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100 shrink-0">
        {!collapsed && <span className="text-sm font-semibold text-slate-700">Test Cases</span>}
        <div className="flex gap-1">
          <button onClick={() => newCase()} className="p-1.5 rounded hover:bg-slate-100" title="New test case">
            <Plus className="h-4 w-4 text-slate-500" />
          </button>
          <button onClick={() => setCollapsed(true)} className="p-1.5 rounded hover:bg-slate-100" title="Collapse sidebar">
            <ChevronLeft className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Conflict resolution view */}
      {isConflictView ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          <p className="text-xs text-slate-600">The following cases already exist:</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {conflicts.map((c) => (
              <div key={c.name} className="flex items-center justify-between p-2 rounded border border-slate-200">
                <p className="text-xs font-medium truncate mr-2">{c.name}</p>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant={resolutions[c.name] === 'overwrite' ? 'default' : 'outline'} className="h-6 px-2 text-xs" onClick={() => setResolutions((r) => ({ ...r, [c.name]: 'overwrite' }))}>Overwrite</Button>
                  <Button size="sm" variant={resolutions[c.name] === 'skip' ? 'default' : 'outline'} className="h-6 px-2 text-xs" onClick={() => setResolutions((r) => ({ ...r, [c.name]: 'skip' }))}>Skip</Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setPendingImport([]); setConflicts([]); setResolutions({}) }}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleConfirmImport}>Confirm</Button>
          </div>
        </div>
      ) : (
        <>
          {/* Case list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isSelecting && savedCases.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5">
                <Checkbox id="select-all" checked={allSelected} onCheckedChange={toggleSelectAll} />
                <label htmlFor="select-all" className="text-xs cursor-pointer select-none">Select All</label>
              </div>
            )}
            {savedCases.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No saved test cases.</p>
            ) : (
              savedCases.map((tc) => (
                <div key={tc.name}>
                  <div
                    onClick={() => !isSelecting && handleSwitch(tc.name)}
                    className={`flex items-center px-3 py-2 cursor-pointer group transition-colors ${
                      tc.name === activeCaseName ? 'bg-slate-800' : 'hover:bg-slate-50'
                    }`}
                  >
                    {isSelecting && (
                      <Checkbox
                        id={`select-${tc.name}`}
                        checked={selectedNames.has(tc.name)}
                        onCheckedChange={() => toggleSelect(tc.name)}
                        onClick={(e) => e.stopPropagation()}
                        className="mr-2 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          tc.name === activeCaseName ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>{tc.mode === 'bulk' ? 'Bulk' : 'Single'}</span>
                        <span className={`text-sm font-medium truncate ${
                          tc.name === activeCaseName ? 'text-white' : 'text-slate-800'
                        }`}>{tc.name}</span>
                      </div>
                      <p className={`text-xs truncate ${
                        tc.name === activeCaseName ? 'text-slate-300' : 'text-slate-400'
                      }`}>{caseHint(tc)}</p>
                    </div>
                    {!isSelecting && (
                      <div className={`flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 ${
                        tc.name === activeCaseName ? 'opacity-100' : ''
                      }`}>
                        <button
                          onClick={(e) => handleDuplicate(e, tc.name)}
                          className={`p-1 rounded hover:bg-slate-200 ${
                            tc.name === activeCaseName ? 'text-slate-300 hover:text-white' : 'text-slate-400'
                          }`}
                          title="Duplicate"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, tc.name)}
                          className={`p-1 rounded hover:bg-red-100 ${
                            tc.name === activeCaseName ? 'text-red-300 hover:text-red-200' : 'text-red-400'
                          }`}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <Separator />
                </div>
              ))
            )}
          </div>

          {/* Save button area */}
          <div className="px-3 py-2 border-t border-slate-100 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start h-7 text-xs"
              onClick={openSaveDialog}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              {activeCaseName ? 'Save' : 'Save As…'}
            </Button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 shrink-0">
            {!isSelecting ? (
              <>
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
                <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => { resetImportState(); fileInputRef.current?.click() }}>
                  <Upload className="h-3.5 w-3.5 mr-1" /> Import
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled={savedCases.length === 0} onClick={() => { setImportSummary(null); setImportError(null); setIsSelecting(true) }}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Export
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={exitSelecting}>Cancel</Button>
                <Button size="sm" className="h-7 text-xs px-2" disabled={selectedNames.size === 0} onClick={handleExport}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Export ({selectedNames.size})
                </Button>
              </>
            )}
          </div>
          {importError && <p className="text-xs text-red-500 px-3 pb-1">{importError}</p>}
          {importSummary && <p className="text-xs text-green-600 px-3 pb-1">{importSummary}</p>}
        </>
      )}

      {/* Save Dialog */}
      <Dialog open={saveOpen} onOpenChange={(open) => { if (!open) handleSaveClose(); else setSaveOpen(true) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{activeCaseName ? 'Save Test Case' : 'Save Test Case As'}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Test case name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
          <DialogFooter className="sm:justify-end">
            <Button variant="outline" size="sm" onClick={handleSaveClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!saveName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}