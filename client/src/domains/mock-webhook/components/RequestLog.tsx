import React from 'react'
import { Trash2 } from 'lucide-react'
import type { RecordedRequest } from '@mintara/shared'
import { Badge } from '../../../components_ui/ui/badge'
import { useMockWebhookStore } from '../store'
import { buildRawCurl } from '../curl'
import { CopyButton } from './CopyButton'

function statusClass(status: number): string {
  if (status >= 500) return 'text-red-600'
  if (status >= 400) return 'text-amber-600'
  return 'text-green-600'
}

function prettyBody(raw: string, json: unknown): string {
  if (json === null) return raw
  return JSON.stringify(json, null, 2)
}

function tryPretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  )
}

function KeyValues({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data)
  if (entries.length === 0) return <p className="text-xs text-slate-400">—</p>
  return (
    <table className="w-full text-xs font-mono">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-slate-100 last:border-0 align-top">
            <td className="py-0.5 pr-3 text-slate-500 whitespace-nowrap">{k}</td>
            <td className="py-0.5 break-all">{Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : JSON.stringify(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Pre({ text }: { text: string }) {
  return (
    <pre className="text-xs font-mono bg-slate-50 border rounded p-2 overflow-auto max-h-80 whitespace-pre-wrap break-all">
      {text || <span className="text-slate-400">(empty)</span>}
    </pre>
  )
}

function RequestDetail({ req, port }: { req: RecordedRequest; port: number }) {
  const curl = buildRawCurl(req.method, `http://localhost:${port}${req.path}`, req.headers, req.rawBody)
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">{req.method}</Badge>
            <code className="text-xs break-all">{req.path}</code>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {new Date(req.timestamp).toLocaleString()} · from {req.ip || 'unknown'}
          </p>
        </div>
        <CopyButton text={curl} label="Copy as cURL" />
      </div>
      <Section title="Query">
        <KeyValues data={req.query} />
      </Section>
      <Section title="Headers">
        <KeyValues data={req.headers} />
      </Section>
      <Section title={req.jsonBody !== null ? 'Body (JSON)' : 'Body (raw)'}>
        <Pre text={prettyBody(req.rawBody, req.jsonBody)} />
      </Section>
      <Section title="Response sent">
        <p className="text-xs">
          <span className={`font-semibold ${statusClass(req.response.status)}`}>{req.response.status}</span>
          <span className="text-slate-400">
            {' '}· {req.response.matched === 'rule' ? 'matched rule' : req.response.matched === 'default' ? 'default response' : 'unknown slug'}
            {req.response.delayMs ? ` · delayed ${req.response.delayMs}ms` : ''}
          </span>
        </p>
        <KeyValues data={req.response.headers} />
        <Pre text={tryPretty(req.response.body)} />
      </Section>
    </div>
  )
}

export function RequestLog() {
  const { requests, selectedRequestId, selectRequest, clearLog, clearAllLogs, port } = useMockWebhookStore()
  const selected = requests.find((r) => r.id === selectedRequestId) ?? requests[0]

  return (
    <div className="border rounded-lg bg-white flex flex-col min-h-[28rem]">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h2 className="text-sm font-semibold text-slate-700">
          Requests <span className="text-xs font-normal text-slate-400">({requests.length}, live)</span>
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clearLog}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
          <button
            type="button"
            onClick={clearAllLogs}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
            title="Clear the request log of every mock"
          >
            <Trash2 className="h-3 w-3" /> Clear all mocks
          </button>
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="p-4 text-xs text-slate-400">Waiting for requests… new calls appear here automatically.</p>
      ) : (
        <div className="flex flex-1 min-h-0">
          <ul className="w-72 shrink-0 border-r overflow-y-auto max-h-[40rem]">
            {requests.map((r) => (
              <li
                key={r.id}
                onClick={() => selectRequest(r.id)}
                className={`px-3 py-2 border-b border-slate-100 cursor-pointer text-xs ${
                  selected?.id === r.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold w-14 shrink-0">{r.method}</span>
                  <span className="font-mono truncate flex-1">{r.subPath}</span>
                  <span className={`font-semibold ${statusClass(r.response.status)}`}>{r.response.status}</span>
                </div>
                <div className="text-slate-400 mt-0.5">{new Date(r.timestamp).toLocaleTimeString()}</div>
              </li>
            ))}
          </ul>
          <div className="flex-1 min-w-0 p-4 overflow-y-auto max-h-[40rem]">
            {selected && <RequestDetail req={selected} port={port} />}
          </div>
        </div>
      )}
    </div>
  )
}
