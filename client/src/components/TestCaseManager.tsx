import React, { useState } from 'react'
import { Save, FolderOpen, Trash2 } from 'lucide-react'
import { Button } from '../components_ui/ui/button'
import { Input } from '../components_ui/ui/input'
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

export function TestCaseManager() {
  const { savedCases, saveCase, loadCase, deleteCase } = useStore()
  const [saveName, setSaveName] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [loadOpen, setLoadOpen] = useState(false)

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

      {/* Load Dialog */}
      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
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
            <DialogTitle>Load Test Case</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 mt-2 max-h-64 overflow-y-auto">
            {savedCases.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No saved test cases.</p>
            ) : (
              savedCases.map((tc) => (
                <div key={tc.name}>
                  <div className="flex items-center justify-between p-2 rounded hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-medium">{tc.name}</p>
                      <p className="text-xs text-slate-500">
                        {tc.mode === 'bulk'
                          ? `Bulk — ${tc.bulkItems?.length ?? 0} request${(tc.bulkItems?.length ?? 0) !== 1 ? 's' : ''}`
                          : `${tc.config.targets.map((t) => t.name).join(' vs ')} — ${tc.config.method}`}
                      </p>
                    </div>
                    <div className="flex gap-1">
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
                  </div>
                  <Separator />
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
