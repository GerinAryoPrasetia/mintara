import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { Input } from '../../../components_ui/ui/input'
import type { BulkRequestItem, TargetOverride } from '@mintara/shared'

interface Props {
  item: BulkRequestItem
  targetNames: string[]
  showBody: boolean
  onChange: (overrides: BulkRequestItem['targetOverrides']) => void
}

export function countOverrides(item: BulkRequestItem): number {
  return Object.values(item.targetOverrides ?? {}).filter(
    (o) => o.path !== undefined || 'body' in o,
  ).length
}

export function TargetOverridesEditor({ item, targetNames, showBody, onChange }: Props) {
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const overrides = item.targetOverrides ?? {}

  // Overrides saved under a name no current target has — shown so they aren't silently dead.
  const orphaned = Object.keys(overrides).filter((n) => !targetNames.includes(n))

  function setOverride(name: string, next: TargetOverride | undefined) {
    const copy = { ...overrides }
    if (next && (next.path !== undefined || 'body' in next)) copy[name] = next
    else delete copy[name]
    onChange(Object.keys(copy).length > 0 ? copy : undefined)
  }

  function renderTarget(name: string, orphan = false) {
    const o = overrides[name] ?? {}
    const hasBody = 'body' in o
    return (
      <div key={name} className="space-y-1.5 rounded border border-slate-200 p-2">
        <div className="text-xs font-semibold text-slate-700">
          {name}
          {orphan && <span className="ml-2 font-normal text-amber-600">(no matching target — ignored)</span>}
        </div>
        <Input
          placeholder={`Path override (default: ${item.path || '—'})`}
          value={o.path ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const { path: _p, ...rest } = o
            setOverride(name, e.target.value ? { ...rest, path: e.target.value } : rest)
          }}
        />
        {showBody && (
          hasBody ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">Body override (JSON)</span>
                <span className="flex items-center gap-2">
                  {errors[name] && <span className="text-xs text-red-500">{errors[name]}</span>}
                  <button
                    type="button"
                    onClick={() => {
                      const { body: _b, ...rest } = o
                      setErrors((p) => ({ ...p, [name]: undefined }))
                      setOverride(name, rest)
                    }}
                    className="text-xs text-red-400 hover:text-red-600 underline underline-offset-2"
                  >
                    Remove body override
                  </button>
                </span>
              </div>
              <div className="border rounded overflow-hidden" style={{ height: 120 }}>
                <Editor
                  height="120px"
                  defaultLanguage="json"
                  value={JSON.stringify(o.body, null, 2) ?? '{}'}
                  onChange={(v: string | undefined) => {
                    try {
                      setOverride(name, { ...o, body: JSON.parse(v || '{}') })
                      setErrors((p) => ({ ...p, [name]: undefined }))
                    } catch {
                      setErrors((p) => ({ ...p, [name]: 'Invalid JSON' }))
                    }
                  }}
                  options={{ minimap: { enabled: false }, lineNumbers: 'off', scrollBeyondLastLine: false }}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOverride(name, { ...o, body: item.body === undefined ? {} : JSON.parse(JSON.stringify(item.body)) })}
              className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2"
            >
              + Override body (starts from the base body)
            </button>
          )
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2 border-t pt-2">
      <p className="text-xs text-slate-500">
        Per-target path/body. Targets without an override use this request's path and body.
      </p>
      {targetNames.map((n) => renderTarget(n))}
      {orphaned.map((n) => renderTarget(n, true))}
    </div>
  )
}
