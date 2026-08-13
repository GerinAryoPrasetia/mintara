import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '../../../components_ui/ui/input'

type HeadersMode = 'kv' | 'raw'

interface KVRow { key: string; value: string }

function headersToKV(headers: Record<string, string>): KVRow[] {
  const rows = Object.entries(headers).map(([key, value]) => ({ key, value }))
  return rows.length > 0 ? rows : [{ key: 'Authorization', value: '' }]
}

function kvToHeaders(rows: KVRow[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const row of rows) {
    if (row.key.trim()) result[row.key.trim()] = row.value
  }
  return result
}

interface HeadersEditorProps {
  headers: Record<string, string>
  onChange: (headers: Record<string, string>) => void
}

export function HeadersEditor({ headers, onChange }: HeadersEditorProps) {
  const [mode, setMode] = useState<HeadersMode>('kv')
  const [kvRows, setKVRows] = useState<KVRow[]>(() => headersToKV(headers))
  const [rawJson, setRawJson] = useState(() => JSON.stringify(headers, null, 2))
  const [error, setError] = useState<string | null>(null)

  const switchMode = (next: HeadersMode) => {
    if (next === mode) return
    if (next === 'raw') {
      const h = kvToHeaders(kvRows)
      onChange(h)
      setRawJson(JSON.stringify(h, null, 2))
      setError(null)
    } else {
      try {
        const parsed = JSON.parse(rawJson || '{}')
        setKVRows(headersToKV(parsed))
        onChange(parsed)
        setError(null)
      } catch {
        setError('Fix JSON before switching')
        return
      }
    }
    setMode(next)
  }

  const updateKV = (index: number, field: 'key' | 'value', val: string) => {
    const updated = kvRows.map((r, i) => (i === index ? { ...r, [field]: val } : r))
    setKVRows(updated)
    onChange(kvToHeaders(updated))
  }

  const addKV = () => setKVRows((prev) => [...prev, { key: '', value: '' }])

  const removeKV = (index: number) => {
    const updated = kvRows.filter((_, i) => i !== index)
    const next = updated.length > 0 ? updated : [{ key: '', value: '' }]
    setKVRows(next)
    onChange(kvToHeaders(next))
  }

  const handleRaw = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setRawJson(text)
    try {
      const parsed = JSON.parse(text || '{}')
      onChange(parsed)
      setError(null)
    } catch {
      setError('Invalid JSON')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-500">{error}</span>}
          <div className="flex rounded border overflow-hidden text-xs">
            <button
              className={`px-2 py-0.5 ${mode === 'kv' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              onClick={() => switchMode('kv')}
            >
              Key-Value
            </button>
            <button
              className={`px-2 py-0.5 border-l ${mode === 'raw' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              onClick={() => switchMode('raw')}
            >
              Raw JSON
            </button>
          </div>
        </div>
      </div>

      {mode === 'kv' ? (
        <div className="space-y-1">
          {kvRows.map((row, i) => (
            <div key={i} className="flex gap-1 items-center">
              <Input
                className="flex-1 h-7 text-xs"
                placeholder="Key"
                value={row.key}
                onChange={(e) => updateKV(i, 'key', e.target.value)}
              />
              <Input
                className="flex-1 h-7 text-xs"
                placeholder={row.key.trim().toLowerCase() === 'authorization' ? 'Bearer <token>' : 'Value'}
                value={row.value}
                onChange={(e) => updateKV(i, 'value', e.target.value)}
              />
              <button
                onClick={() => removeKV(i)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={addKV}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 py-0.5"
          >
            <Plus className="h-3 w-3" />
            Add header
          </button>
        </div>
      ) : (
        <textarea
          className="w-full border rounded p-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-slate-300"
          rows={5}
          value={rawJson}
          onChange={handleRaw}
          spellCheck={false}
        />
      )}
    </div>
  )
}
