import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '../components_ui/ui/input'

interface KVRow { key: string; value: string }

interface QueryParamsEditorProps {
  path: string
  onChange: (path: string) => void
}

function parsePath(path: string): { pathname: string; rows: KVRow[] } {
  const qIdx = path.indexOf('?')
  if (qIdx === -1) return { pathname: path, rows: [] }
  const pathname = path.slice(0, qIdx)
  const params = new URLSearchParams(path.slice(qIdx + 1))
  const rows: KVRow[] = []
  params.forEach((value, key) => rows.push({ key, value }))
  return { pathname, rows }
}

function serializePath(pathname: string, rows: KVRow[]): string {
  const filled = rows.filter((r) => r.key.trim())
  if (filled.length === 0) return pathname
  const qs = filled.map((r) => `${encodeURIComponent(r.key.trim())}=${encodeURIComponent(r.value)}`).join('&')
  return `${pathname}?${qs}`
}

export function QueryParamsEditor({ path, onChange }: QueryParamsEditorProps) {
  const { pathname, rows: initialRows } = parsePath(path)
  const [rows, setRows] = React.useState<KVRow[]>(initialRows)
  const [currentPathname, setCurrentPathname] = React.useState(pathname)

  // Re-sync when the path prop changes externally (e.g. user typed in path input)
  React.useEffect(() => {
    const { pathname: newPathname, rows: newRows } = parsePath(path)
    setCurrentPathname(newPathname)
    setRows(newRows)
  }, [path])

  const updateRows = (next: KVRow[]) => {
    setRows(next)
    onChange(serializePath(currentPathname, next))
  }

  const updateRow = (index: number, field: 'key' | 'value', val: string) => {
    const updated = rows.map((r, i) => (i === index ? { ...r, [field]: val } : r))
    updateRows(updated)
  }

  const addRow = () => updateRows([...rows, { key: '', value: '' }])

  const removeRow = (index: number) => {
    const updated = rows.filter((_, i) => i !== index)
    updateRows(updated)
  }

  return (
    <div className="space-y-1">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-1 items-center">
          <Input
            className="flex-1 h-7 text-xs"
            placeholder="Key"
            value={row.key}
            onChange={(e) => updateRow(i, 'key', e.target.value)}
          />
          <Input
            className="flex-1 h-7 text-xs"
            placeholder="Value"
            value={row.value}
            onChange={(e) => updateRow(i, 'value', e.target.value)}
          />
          <button
            onClick={() => removeRow(i)}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={addRow}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 py-0.5"
      >
        <Plus className="h-3 w-3" />
        Add param
      </button>
    </div>
  )
}
