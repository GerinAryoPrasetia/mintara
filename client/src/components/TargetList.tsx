import React, { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '../components_ui/ui/button'
import { Input } from '../components_ui/ui/input'
import { useStore } from '../store'
import { HeadersEditor } from './HeadersEditor'

export function TargetList({ hideHeaders = false }: { hideHeaders?: boolean }) {
  const { request, setRequest } = useStore()
  const { targets } = request
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  const updateTarget = (index: number, field: 'name' | 'baseUrl', value: string) => {
    const updated = targets.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    setRequest({ targets: updated })
  }

  const updateHeaders = (index: number, headers: Record<string, string>) => {
    const updated = targets.map((t, i) => (i === index ? { ...t, headers } : t))
    setRequest({ targets: updated })
  }

  const addTarget = () => {
    setRequest({ targets: [...targets, { name: `Target ${targets.length + 1}`, baseUrl: '', headers: {} }] })
  }

  const removeTarget = (index: number) => {
    if (targets.length <= 2) return
    setRequest({ targets: targets.filter((_, i) => i !== index) })
    setExpanded((prev) => {
      const next: Record<number, boolean> = {}
      Object.entries(prev).forEach(([k, v]) => {
        const n = Number(k)
        if (n < index) next[n] = v
        else if (n > index) next[n - 1] = v
      })
      return next
    })
  }

  const toggleExpanded = (index: number) => {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">Targets</label>
      {targets.map((target, i) => {
        const headerCount = Object.keys(target.headers ?? {}).length
        const isExpanded = !!expanded[i]

        return (
          <div key={i} className="border rounded-md p-2 space-y-1 bg-slate-50">
            <div className="flex gap-2 items-center">
              <Input
                className="w-28 shrink-0 h-8 text-sm"
                placeholder="Name"
                value={target.name}
                onChange={(e) => updateTarget(i, 'name', e.target.value)}
              />
              <Input
                className="flex-1 h-8 text-sm"
                placeholder="http://localhost:3004"
                value={target.baseUrl}
                onChange={(e) => updateTarget(i, 'baseUrl', e.target.value)}
              />
              {!hideHeaders && (
                <button
                  onClick={() => toggleExpanded(i)}
                  className="flex items-center gap-1 shrink-0 text-xs text-slate-500 hover:text-slate-700 px-1.5 py-1 rounded border bg-white hover:bg-slate-50"
                  title="Toggle headers"
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <span>Headers{headerCount > 0 ? ` (${headerCount})` : ''}</span>
                </button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8"
                onClick={() => removeTarget(i)}
                disabled={targets.length <= 2}
                title="Remove target"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {!hideHeaders && isExpanded && (
              <HeadersEditor
                headers={target.headers ?? {}}
                onChange={(h) => updateHeaders(i, h)}
              />
            )}
          </div>
        )
      })}
      <Button variant="outline" size="sm" onClick={addTarget} className="w-full">
        <Plus className="h-4 w-4 mr-1" />
        Add Target
      </Button>
    </div>
  )
}
