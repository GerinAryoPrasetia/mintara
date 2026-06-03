import React, { useState, useEffect, useRef } from 'react'
import ExcelJS from 'exceljs'
import Editor from '@monaco-editor/react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components_ui/ui/select'
import { Button } from '../components_ui/ui/button'
import { Input } from '../components_ui/ui/input'
import { Trash2, Plus, ChevronDown, ChevronUp, Upload, Download, Info, ArrowDown, Copy, Check, CopyPlus } from 'lucide-react'
import { buildCurl } from '../lib/curl'
import { useStore } from '../store'
import { HeadersEditor } from './HeadersEditor'
import { NormalizationEditor } from './NormalizationEditor'
import { QueryParamsEditor } from './QueryParamsEditor'
import { TargetList } from './TargetList'
import { AuthHeaderManager } from './AuthHeaderManager'
import type { HttpMethod, BulkRequestItem, NormalizationOptions } from '@mintara/shared'

const DEFAULT_NORMALIZATION: NormalizationOptions = { ignoreFields: [], sortArrays: false }

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE']

function newItem(): BulkRequestItem {
  return { id: crypto.randomUUID(), method: 'GET', path: '', body: undefined, headers: {} }
}

function parseCSV(text: string): string[][] {
  const result: string[][] = []
  let row: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]
    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(current)
        current = ''
      } else if (char === '\n' || char === '\r') {
        row.push(current)
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
          result.push(row)
        }
        row = []
        current = ''
        if (char === '\r' && next === '\n') i++
      } else {
        current += char
      }
    }
  }
  if (current || row.length > 0) {
    row.push(current)
    result.push(row)
  }
  return result
}

export function BulkRequestBuilder() {
  const {
    request,
    bulkItems,
    setBulkItems,
    bulkSharedHeaders,
    setBulkSharedHeaders,
    usePerRequestHeaders,
    setUsePerRequestHeaders,
    isBulkRunning,
    bulkResults,
    runBulk,
    activeCaseName,
  } = useStore()

  // Sets of item IDs with expanded body / headers / normalization panels
  const [expandedBody, setExpandedBody] = useState<Set<string>>(new Set())
  const [expandedHeaders, setExpandedHeaders] = useState<Set<string>>(new Set())
  const [expandedNorm, setExpandedNorm] = useState<Set<string>>(new Set())

  // Per-item body editor error state
  const [editorErrors, setEditorErrors] = useState<Record<string, { body?: string }>>({})

  // Per-item copy-as-curl flash state
  const [copiedItems, setCopiedItems] = useState<Record<string, boolean>>({})

  function copyItemAsCurl(item: BulkRequestItem) {
    const headers = usePerRequestHeaders ? (item.headers ?? {}) : bulkSharedHeaders
    const curlBlocks = request.targets.map((target) => {
      const fullUrl = target.baseUrl.replace(/\/$/, '') + (item.path.startsWith('/') ? item.path : `/${item.path}`)
      const curl = buildCurl(item.method, fullUrl, { ...headers, ...target.headers }, item.body)
      return `# ${target.name}\n${curl}`
    })
    navigator.clipboard.writeText(curlBlocks.join('\n\n')).catch(() => {})
    setCopiedItems((prev) => ({ ...prev, [item.id]: true }))
    setTimeout(() => setCopiedItems((prev) => ({ ...prev, [item.id]: false })), 1500)
  }

  // Import state
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function jumpTo(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el.classList.remove('jump-highlight')
    void el.offsetWidth // force reflow to restart animation
    el.classList.add('jump-highlight')
  }

  // Auto-add one item when list is empty on mount
  useEffect(() => {
    if (bulkItems.length === 0) {
      setBulkItems([newItem()])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand body panels when a saved case is loaded (e.g. from JSON collection import)
  useEffect(() => {
    if (activeCaseName === null) return
    const withBody = new Set(bulkItems.filter((i) => i.body !== undefined).map((i) => i.id))
    if (withBody.size > 0) setExpandedBody(withBody)
  }, [activeCaseName]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── helpers ──────────────────────────────────────────────────────────────

  function toggleExpand(set: Set<string>, id: string): Set<string> {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  function updateItem(id: string, patch: Partial<BulkRequestItem>) {
    setBulkItems(bulkItems.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function setItemError(id: string, field: 'body', msg: string | undefined) {
    setEditorErrors((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: msg },
    }))
  }

  function deleteItem(id: string) {
    if (bulkItems.length <= 1) return
    setBulkItems(bulkItems.filter((item) => item.id !== id))
    // Clean up expansion state
    setExpandedBody((s) => { const n = new Set(s); n.delete(id); return n })
    setExpandedHeaders((s) => { const n = new Set(s); n.delete(id); return n })
    setExpandedNorm((s) => { const n = new Set(s); n.delete(id); return n })
    setEditorErrors((prev) => { const next = { ...prev }; delete next[id]; return next })
  }

  function duplicateItem(id: string) {
    const idx = bulkItems.findIndex((i) => i.id === id)
    if (idx === -1) return
    const source = bulkItems[idx]
    const clone: BulkRequestItem = {
      ...source,
      id: crypto.randomUUID(),
      body: source.body !== undefined ? JSON.parse(JSON.stringify(source.body)) : undefined,
      headers: { ...(source.headers ?? {}) },
      normalization: source.normalization
        ? { ...source.normalization, ignoreFields: [...(source.normalization.ignoreFields ?? [])] }
        : undefined,
    }
    const next = [...bulkItems]
    next.splice(idx + 1, 0, clone)
    setBulkItems(next)
  }

  function addItem() {
    setBulkItems([...bulkItems, newItem()])
  }

  // ── Per-item body ─────────────────────────────────────────────────────────

  function handleBodyChange(id: string, value: string | undefined) {
    if (!value) {
      updateItem(id, { body: undefined })
      setItemError(id, 'body', undefined)
      return
    }
    try {
      const parsed = JSON.parse(value)
      updateItem(id, { body: parsed })
      setItemError(id, 'body', undefined)
    } catch {
      setItemError(id, 'body', 'Invalid JSON')
    }
  }

  // ── Excel / CSV import ──────────────────────────────────────────────────

  async function handleImportFile(file: File) {
    setImportError(null)
    const isCsv = file.name.toLowerCase().endsWith('.csv')
    try {
      let items: BulkRequestItem[] = []
      let firstRowHeaders: Record<string, string> | null = null

      if (isCsv) {
        const text = await file.text()
        const rows = parseCSV(text)
        if (rows.length < 2) {
          setImportError('CSV is empty or missing headers')
          return
        }

        const headerRow = rows[0].map((h) => h.trim().toUpperCase())
        const colIndex: Record<string, number> = {}
        headerRow.forEach((h, i) => {
          colIndex[h] = i
        })

        // Detect format: Activity Log vs Template
        const isActivityLog = colIndex['URLPATH'] !== undefined && colIndex['METHOD'] !== undefined

        if (isActivityLog) {
          const methodIdx = colIndex['METHOD']
          const urlIdx = colIndex['URLPATH']
          const headersIdx = colIndex['HEADERS']
          const bodyIdx = colIndex['REQUESTBODY']

          rows.slice(1).forEach((row) => {
            const method = String(row[methodIdx] || 'GET').toUpperCase() as HttpMethod
            const rawUrl = String(row[urlIdx] || '')
            const rawHeaders = String(row[headersIdx] || '{}')
            const rawBody = String(row[bodyIdx] || '')

            let path = rawUrl
            try {
              if (rawUrl.startsWith('http')) {
                const u = new URL(rawUrl)
                path = u.pathname + u.search
              }
            } catch {
              /* ignore */
            }

            let headers: Record<string, string> = {}
            try {
              const parsed = JSON.parse(rawHeaders)
              Object.entries(parsed).forEach(([k, v]) => {
                headers[k] = Array.isArray(v) ? String(v[0]) : String(v)
              })
            } catch {
              /* ignore */
            }

            let body: unknown = undefined
            if (rawBody && rawBody !== '[]' && rawBody !== '{}') {
              try {
                body = JSON.parse(rawBody)
              } catch {
                /* ignore */
              }
            }

            items.push({
              id: crypto.randomUUID(),
              method: METHODS.includes(method) ? method : 'GET',
              path,
              body,
              headers,
            })
          })
          if (items.length > 0) firstRowHeaders = items[0].headers ?? null
          // Automatically switch to per-request headers for activity logs
          setUsePerRequestHeaders(true)
        } else {
          // Template format (CSV)
          const methodCol = colIndex['METHOD']
          const urlCol = colIndex['URL']
          const qpCol = colIndex['QUERY PARAMS']
          const bodyCol = colIndex['REQUEST BODY']
          const headersCol = colIndex['HEADERS']

          if (methodCol === undefined || urlCol === undefined) {
            setImportError('Missing required columns: METHOD, URL')
            return
          }

          rows.slice(1).forEach((row) => {
            const method = String(row[methodCol] || 'GET').toUpperCase() as HttpMethod
            const url = String(row[urlCol] || '').trim()
            const qpRaw = qpCol !== undefined ? String(row[qpCol] || '').trim() : ''
            const bodyRaw = bodyCol !== undefined ? String(row[bodyCol] || '').trim() : ''
            const hdRaw = headersCol !== undefined ? String(row[headersCol] || '').trim() : ''

            let path = url
            if (qpRaw) {
              try {
                const params = JSON.parse(qpRaw) as Record<string, string>
                const qs = Object.entries(params)
                  .filter(([k]) => k.trim())
                  .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
                  .join('&')
                if (qs) path = `${path}${path.includes('?') ? '&' : '?'}${qs}`
              } catch {
                if (qpRaw && !path.includes('?')) path = `${path}?${qpRaw}`
              }
            }

            let body: unknown = undefined
            if (bodyRaw) {
              try {
                body = JSON.parse(bodyRaw)
              } catch {
                /* ignore */
              }
            }

            let headers: Record<string, string> = {}
            if (hdRaw) {
              try {
                headers = JSON.parse(hdRaw)
              } catch {
                /* ignore */
              }
            }

            items.push({
              id: crypto.randomUUID(),
              method: METHODS.includes(method) ? method : 'GET',
              path,
              body,
              headers,
            })
          })
          if (items.length > 0) firstRowHeaders = items[0].headers ?? null
        }
      } else {
        // Excel import (Existing logic)
        const buffer = await file.arrayBuffer()
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(buffer)

        const sheet = workbook.worksheets[0]
        if (!sheet) {
          setImportError('No worksheet found')
          return
        }

        const colIndex: Record<string, number> = {}
        sheet.getRow(1).eachCell((cell, colNum) => {
          colIndex[String(cell.value ?? '').toUpperCase().trim()] = colNum
        })

        const methodCol = colIndex['METHOD']
        const urlCol = colIndex['URL']
        const qpCol = colIndex['QUERY PARAMS']
        const bodyCol = colIndex['REQUEST BODY']
        const headersCol = colIndex['HEADERS']

        if (!methodCol || !urlCol) {
          setImportError('Missing required columns: METHOD, URL')
          return
        }

        sheet.eachRow((row, rowNum) => {
          if (rowNum === 1) return

          const method = String(row.getCell(methodCol).value ?? 'GET').toUpperCase().trim() as HttpMethod
          const url = String(row.getCell(urlCol).value ?? '').trim()
          const qpRaw = qpCol ? String(row.getCell(qpCol).value ?? '').trim() : ''
          const bodyRaw = bodyCol ? String(row.getCell(bodyCol).value ?? '').trim() : ''
          const hdRaw = headersCol ? String(row.getCell(headersCol).value ?? '').trim() : ''

          let path = url
          if (qpRaw) {
            try {
              const params = JSON.parse(qpRaw) as Record<string, string>
              const qs = Object.entries(params)
                .filter(([k]) => k.trim())
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
                .join('&')
              if (qs) path = `${path}${path.includes('?') ? '&' : '?'}${qs}`
            } catch {
              if (qpRaw && !path.includes('?')) path = `${path}?${qpRaw}`
            }
          }

          let body: unknown = undefined
          if (bodyRaw) {
            try {
              body = JSON.parse(bodyRaw)
            } catch {
              /* ignore */
            }
          }

          let headers: Record<string, string> = {}
          if (hdRaw) {
            try {
              headers = JSON.parse(hdRaw)
            } catch {
              /* ignore */
            }
          }

          if (rowNum === 2) firstRowHeaders = headers

          items.push({
            id: crypto.randomUUID(),
            method: METHODS.includes(method) ? method : 'GET',
            path,
            body,
            headers,
          })
        })
      }

      if (items.length === 0) {
        setImportError('No data rows found')
        return
      }

      setBulkItems(items)

      // Auto-expand body panel for items that have a body imported
      const withBody = new Set(items.filter((i) => i.body !== undefined).map((i) => i.id))
      if (withBody.size > 0) setExpandedBody(withBody)

      if (!usePerRequestHeaders && firstRowHeaders) {
        setBulkSharedHeaders(firstRowHeaders)
      }
    } catch (e) {
      setImportError(`Import failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function downloadTemplate() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Bulk Requests')

    sheet.columns = [
      { header: 'METHOD',       key: 'method',      width: 10 },
      { header: 'URL',          key: 'url',         width: 32 },
      { header: 'QUERY PARAMS', key: 'queryParams', width: 32 },
      { header: 'REQUEST BODY', key: 'body',        width: 44 },
      { header: 'HEADERS',      key: 'headers',     width: 44 },
    ]

    // Bold header row
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }

    // Example rows
    sheet.addRow({
      method: 'GET',
      url: '/api/v1/users',
      queryParams: '{"page": "1", "limit": "10"}',
      body: '',
      headers: '{"Authorization": "Bearer <token>"}',
    })
    sheet.addRow({
      method: 'POST',
      url: '/api/v1/users',
      queryParams: '',
      body: '{"name": "John Doe", "email": "john@example.com"}',
      headers: '{"Authorization": "Bearer <token>", "Content-Type": "application/json"}',
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'bulk-requests-template.xlsx'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  // ── derived ───────────────────────────────────────────────────────────────

  const canRun =
    bulkItems.length > 0 &&
    bulkItems.every((item) => item.path.trim() !== '') &&
    request.targets.every((t) => t.baseUrl.trim() !== '') &&
    !isBulkRunning

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* 0. Target URLs */}
      <TargetList hideHeaders />

      {/* 1. Headers mode toggle */}
      <div className="flex items-center gap-0 rounded-full border border-slate-200 overflow-hidden w-fit">
        <button
          type="button"
          onClick={() => setUsePerRequestHeaders(false)}
          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
            !usePerRequestHeaders
              ? 'bg-slate-800 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Shared Headers
        </button>
        <button
          type="button"
          onClick={() => setUsePerRequestHeaders(true)}
          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
            usePerRequestHeaders
              ? 'bg-slate-800 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Per-Request Headers
        </button>
      </div>

      {/* 1b. Import / Export toolbar */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImportFile(file)
            e.target.value = ''
          }}
        />
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Import from Excel / CSV
          </Button>
          <div className="relative group">
            <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-slate-800 text-white text-xs rounded-md px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              <p className="font-semibold mb-1">Supported CSV formats</p>
              <p className="font-medium mt-1">Template format (columns):</p>
              <p className="text-slate-300">METHOD, URL, QUERY PARAMS, REQUEST BODY, HEADERS</p>
              <p className="font-medium mt-1">Activity Log format (columns):</p>
              <p className="text-slate-300">METHOD, URLPATH, HEADERS, REQUESTBODY</p>
              <p className="text-slate-400 mt-1">Headers and body columns expect JSON strings.</p>
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800" />
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Download Template
        </Button>
        {importError && (
          <span className="text-xs text-red-500">{importError}</span>
        )}
      </div>

      {/* 2. Shared headers editor */}
      {!usePerRequestHeaders && (
        <div className="border rounded-lg p-3 bg-slate-50">
          <label className="text-xs font-medium text-slate-600 block mb-2">Shared Headers</label>
          <HeadersEditor
            headers={bulkSharedHeaders}
            onChange={setBulkSharedHeaders}
          />
        </div>
      )}

      {/* 2b. Authorization header manager (per-request mode only) */}
      {usePerRequestHeaders && (
        <AuthHeaderManager
          items={bulkItems}
          onUpdateItems={setBulkItems}
        />
      )}

      {/* 3. Request rows */}
      <div className="space-y-2">
        {bulkItems.map((item) => {
          const showBody = item.method === 'POST' || item.method === 'PUT'
          const isBodyExpanded = expandedBody.has(item.id)
          const isHeadersExpanded = expandedHeaders.has(item.id)
          const isNormExpanded = expandedNorm.has(item.id)
          const hasCustomNorm = item.normalization !== undefined
          const itemErrors = editorErrors[item.id] ?? {}
          const hasResult = bulkResults.some((r) => r.item.id === item.id && r.status !== 'pending')

          return (
            <div key={item.id} id={`request-item-${item.id}`} className="border rounded-lg p-3 space-y-2 bg-white">
              {/* Row: method + path + delete */}
              <div className="flex items-center gap-2">
                <Select
                  value={item.method}
                  onValueChange={(v: string) => updateItem(item.id, { method: v as HttpMethod })}
                >
                  <SelectTrigger className="w-28 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  className="flex-1"
                  placeholder="/api/v1/resource"
                  value={item.path}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(item.id, { path: e.target.value })}
                />

                {hasResult && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Jump to result"
                    onClick={() => jumpTo(`result-item-${item.id}`)}
                    className="shrink-0 text-slate-400 hover:text-blue-500"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                )}

                <button
                  onClick={() => copyItemAsCurl(item)}
                  className="flex items-center shrink-0 px-1.5 py-1 rounded border bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700"
                  title="Copy as cURL"
                >
                  {copiedItems[item.id]
                    ? <Check className="h-3.5 w-3.5 text-green-500" />
                    : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => duplicateItem(item.id)}
                  className="flex items-center shrink-0 px-1.5 py-1 rounded border bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700"
                  title="Duplicate request"
                >
                  <CopyPlus className="h-3.5 w-3.5" />
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={bulkItems.length <= 1}
                  onClick={() => deleteItem(item.id)}
                  className="shrink-0 text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Query params */}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Query Params</label>
                <QueryParamsEditor
                  path={item.path}
                  onChange={(path) => updateItem(item.id, { path })}
                />
              </div>

              {/* Toggle buttons row */}
              <div className="flex items-center gap-2">
                  {showBody && (
                    <button
                      type="button"
                      onClick={() => setExpandedBody((s) => toggleExpand(s, item.id))}
                      className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      Body
                      {isBodyExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  )}

                  {usePerRequestHeaders && (
                    <button
                      type="button"
                      onClick={() => setExpandedHeaders((s) => toggleExpand(s, item.id))}
                      className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      Headers
                      {isHeadersExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (!hasCustomNorm) updateItem(item.id, { normalization: DEFAULT_NORMALIZATION })
                      setExpandedNorm((s) => toggleExpand(s, item.id))
                    }}
                    className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border transition-colors ${
                      hasCustomNorm
                        ? 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100'
                        : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    Normalization{hasCustomNorm ? ' (custom)' : ''}
                    {isNormExpanded ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </div>

              {/* Body editor */}
              {showBody && isBodyExpanded && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-600">Body (JSON)</label>
                    {itemErrors.body && (
                      <span className="text-xs text-red-500">{itemErrors.body}</span>
                    )}
                  </div>
                  <div className="border rounded overflow-hidden" style={{ height: 120 }}>
                    <Editor
                      height="120px"
                      defaultLanguage="json"
                      defaultValue="{}"
                      value={item.body !== undefined ? JSON.stringify(item.body, null, 2) : '{}'}
                      onChange={(v: string | undefined) => handleBodyChange(item.id, v)}
                      options={{ minimap: { enabled: false }, lineNumbers: 'off', scrollBeyondLastLine: false }}
                    />
                  </div>
                </div>
              )}

              {/* Per-request headers editor */}
              {usePerRequestHeaders && isHeadersExpanded && (
                <div className="space-y-2">
                  <HeadersEditor
                    headers={item.headers ?? {}}
                    onChange={(h) => updateItem(item.id, { headers: h })}
                  />
                  {bulkItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const headers = item.headers ?? {}
                        setBulkItems(bulkItems.map((other) =>
                          other.id === item.id ? other : { ...other, headers }
                        ))
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2"
                    >
                      Apply to all
                    </button>
                  )}
                </div>
              )}

              {/* Per-request normalization editor */}
              {isNormExpanded && item.normalization && (
                <div className="space-y-2 border-t pt-2">
                  <NormalizationEditor
                    id={item.id}
                    value={item.normalization}
                    onChange={(normalization) => updateItem(item.id, { normalization })}
                  />
                  <div className="flex items-center gap-3">
                    {bulkItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const normalization = item.normalization
                          setBulkItems(bulkItems.map((other) =>
                            other.id === item.id ? other : { ...other, normalization }
                          ))
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2"
                      >
                        Apply to all
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        updateItem(item.id, { normalization: undefined })
                        setExpandedNorm((s) => { const n = new Set(s); n.delete(item.id); return n })
                      }}
                      className="text-xs text-red-400 hover:text-red-600 underline underline-offset-2"
                    >
                      Reset to global
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 4. Add Request button */}
      <Button variant="outline" className="w-full" onClick={addItem}>
        <Plus className="h-4 w-4 mr-2" />
        Add Request
      </Button>

      {/* 5. Run Bulk button */}
      <Button className="w-full" disabled={!canRun} onClick={runBulk}>
        {isBulkRunning ? 'Running…' : 'Run Bulk'}
      </Button>
    </div>
  )
}
