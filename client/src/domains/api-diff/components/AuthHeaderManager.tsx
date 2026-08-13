import React, { useState, useMemo } from 'react'
import { KeyRound, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '../../../components_ui/ui/button'
import { Input } from '../../../components_ui/ui/input'
import type { BulkRequestItem } from '@mintara/shared'

function getAuthEntry(headers: Record<string, string> | undefined): { key: string; value: string } | null {
  if (!headers) return null
  const entry = Object.entries(headers).find(([k]) => k.toLowerCase() === 'authorization')
  return entry ? { key: entry[0], value: entry[1] } : null
}

interface AuthGroup {
  value: string
  key: string // original header key casing
  items: BulkRequestItem[]
}

interface Props {
  items: BulkRequestItem[]
  onUpdateItems: (items: BulkRequestItem[]) => void
}

export function AuthHeaderManager({ items, onUpdateItems }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  const { groups, noAuthItems } = useMemo(() => {
    const map = new Map<string, { key: string; items: BulkRequestItem[] }>()
    const noAuth: BulkRequestItem[] = []

    for (const item of items) {
      const entry = getAuthEntry(item.headers)
      if (!entry) {
        noAuth.push(item)
        continue
      }
      if (!map.has(entry.value)) {
        map.set(entry.value, { key: entry.key, items: [] })
      }
      map.get(entry.value)!.items.push(item)
    }

    const groups: AuthGroup[] = [...map.entries()].map(([value, { key, items }]) => ({
      value,
      key,
      items,
    }))

    return { groups, noAuthItems: noAuth }
  }, [items])

  if (items.length === 0) return null

  const getEditValue = (originalValue: string) =>
    editValues[originalValue] ?? originalValue

  const handleApply = (group: AuthGroup) => {
    const newValue = getEditValue(group.value)
    const groupIds = new Set(group.items.map((i) => i.id))
    onUpdateItems(
      items.map((item) => {
        if (!groupIds.has(item.id)) return item
        const headers = { ...item.headers }
        if (newValue.trim()) {
          headers[group.key] = newValue.trim()
        } else {
          const keyToRemove = Object.keys(headers).find((k) => k.toLowerCase() === 'authorization')
          if (keyToRemove) delete headers[keyToRemove]
        }
        return { ...item, headers }
      }),
    )
  }

  const groupCount = groups.length
  const noAuthCount = noAuthItems.length

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
      >
        <KeyRound className="h-4 w-4 text-slate-500 shrink-0" />
        <span className="text-sm font-medium text-slate-700">Authorization Headers</span>
        <span className="text-xs text-slate-400 ml-1">
          ({groupCount} group{groupCount !== 1 ? 's' : ''}
          {noAuthCount > 0 ? `, ${noAuthCount} without auth` : ''})
        </span>
        <span className="ml-auto text-slate-400 shrink-0">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t divide-y">
          {groups.length === 0 && noAuthItems.length === 0 && (
            <p className="px-3 py-3 text-xs text-slate-400 italic">No requests yet.</p>
          )}

          {groups.map((group, idx) => (
            <div key={group.value} className="px-3 py-3 space-y-2">
              <p className="text-xs font-medium text-slate-600">
                Group {idx + 1}
                <span className="ml-1 font-normal text-slate-400">
                  — {group.items.length} request{group.items.length !== 1 ? 's' : ''}
                </span>
              </p>

              <div className="flex gap-2">
                <Input
                  className="flex-1 font-mono text-xs h-8"
                  value={getEditValue(group.value)}
                  onChange={(e) =>
                    setEditValues((prev) => ({ ...prev, [group.value]: e.target.value }))
                  }
                  placeholder="Bearer <token>"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={() => handleApply(group)}
                >
                  Apply All
                </Button>
              </div>

              <div className="flex flex-wrap gap-1">
                {group.items.slice(0, 12).map((item) => (
                  <span
                    key={item.id}
                    className="bg-slate-100 rounded px-1.5 py-0.5 text-xs font-mono text-slate-600"
                  >
                    {item.method} {item.path || '/'}
                  </span>
                ))}
                {group.items.length > 12 && (
                  <span className="text-xs text-slate-400 self-center">
                    +{group.items.length - 12} more
                  </span>
                )}
              </div>
            </div>
          ))}

          {noAuthItems.length > 0 && (
            <div className="px-3 py-3 space-y-2">
              <p className="text-xs font-medium text-slate-400">
                No Authorization header
                <span className="ml-1 font-normal">
                  — {noAuthItems.length} request{noAuthItems.length !== 1 ? 's' : ''}
                </span>
              </p>
              <div className="flex flex-wrap gap-1">
                {noAuthItems.slice(0, 12).map((item) => (
                  <span
                    key={item.id}
                    className="bg-slate-50 border rounded px-1.5 py-0.5 text-xs font-mono text-slate-400"
                  >
                    {item.method} {item.path || '/'}
                  </span>
                ))}
                {noAuthItems.length > 12 && (
                  <span className="text-xs text-slate-400 self-center">
                    +{noAuthItems.length - 12} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
