import React, { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react'
import type { MockMethod, MockResponse, MockRule, MockSlug } from '@mintara/shared'
import { Button } from '../../../components_ui/ui/button'
import { Input } from '../../../components_ui/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components_ui/ui/select'
import { useMockWebhookStore } from '../store'

const METHODS: MockMethod[] = ['ANY', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const textareaClass =
  'w-full border rounded p-2 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-slate-300'

/** Headers are edited as `Name: value` lines — compact and paste-friendly. */
function headersToText(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

function textToHeaders(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const i = line.indexOf(':')
    if (i <= 0) continue
    const key = line.slice(0, i).trim()
    if (key) out[key] = line.slice(i + 1).trim()
  }
  return out
}

interface DraftResponse extends Omit<MockResponse, 'headers'> {
  headersText: string
}
interface DraftRule extends Omit<MockRule, 'response'> {
  response: DraftResponse
}

const toDraftResponse = (r: MockResponse): DraftResponse => ({
  status: r.status,
  body: r.body,
  delayMs: r.delayMs,
  headersText: headersToText(r.headers),
})

const fromDraftResponse = (d: DraftResponse): MockResponse => ({
  status: d.status,
  body: d.body,
  headers: textToHeaders(d.headersText),
  ...(d.delayMs ? { delayMs: d.delayMs } : {}),
})

function ResponseFields({ value, onChange }: { value: DraftResponse; onChange: (v: DraftResponse) => void }) {
  const bodyIsInvalidJson = (() => {
    if (!/application\/json/i.test(value.headersText) || !value.body.trim() || value.body.includes('{{')) return false
    try {
      JSON.parse(value.body)
      return false
    } catch {
      return true
    }
  })()

  return (
    <div className="grid grid-cols-[7rem_7rem_1fr] gap-2">
      <label className="text-xs text-slate-500 space-y-1">
        <span>Status</span>
        <Input
          type="number"
          className="h-7 text-xs"
          value={value.status}
          onChange={(e) => onChange({ ...value, status: Number(e.target.value) })}
        />
      </label>
      <label className="text-xs text-slate-500 space-y-1">
        <span>Delay (ms)</span>
        <Input
          type="number"
          min={0}
          className="h-7 text-xs"
          value={value.delayMs ?? ''}
          onChange={(e) => onChange({ ...value, delayMs: e.target.value ? Number(e.target.value) : undefined })}
        />
      </label>
      <label className="text-xs text-slate-500 space-y-1">
        <span>Headers (one per line)</span>
        <textarea
          className={textareaClass}
          rows={2}
          spellCheck={false}
          value={value.headersText}
          onChange={(e) => onChange({ ...value, headersText: e.target.value })}
        />
      </label>
      <label className="col-span-3 text-xs text-slate-500 space-y-1">
        <span className="flex items-center gap-2">
          Body
          {bodyIsInvalidJson && <span className="text-amber-600">not valid JSON — sent as-is</span>}
        </span>
        <textarea
          className={textareaClass}
          rows={4}
          spellCheck={false}
          value={value.body}
          onChange={(e) => onChange({ ...value, body: e.target.value })}
        />
      </label>
    </div>
  )
}

export function MockRulesEditor({ mock }: { mock: MockSlug }) {
  const save = useMockWebhookStore((s) => s.save)
  const initialRules = (): DraftRule[] => mock.rules.map((r) => ({ ...r, response: toDraftResponse(r.response) }))
  const [rules, setRules] = useState<DraftRule[]>(initialRules)
  const [defaultResponse, setDefaultResponse] = useState<DraftResponse>(() => toDraftResponse(mock.defaultResponse))
  const [saving, setSaving] = useState(false)

  const patch = {
    rules: rules.map((r) => ({ ...r, response: fromDraftResponse(r.response) })),
    defaultResponse: fromDraftResponse(defaultResponse),
  }
  const dirty =
    JSON.stringify(patch) !==
    JSON.stringify({
      rules: initialRules().map((r) => ({ ...r, response: fromDraftResponse(r.response) })),
      defaultResponse: fromDraftResponse(toDraftResponse(mock.defaultResponse)),
    })

  const updateRule = (i: number, next: Partial<DraftRule>) =>
    setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...next } : r)))

  const move = (i: number, delta: number) =>
    setRules((rs) => {
      const j = i + delta
      if (j < 0 || j >= rs.length) return rs
      const copy = [...rs]
      ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
      return copy
    })

  const addRule = () =>
    setRules((rs) => [
      ...rs,
      {
        id: crypto.randomUUID(),
        method: 'POST',
        path: '/',
        response: { status: 200, body: '{"status":"success"}', headersText: 'Content-Type: application/json' },
      },
    ])

  const onSave = async () => {
    setSaving(true)
    await save(mock.slug, patch)
    setSaving(false)
  }

  return (
    <div className="border rounded-lg bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Rules</h2>
          <p className="text-xs text-slate-400">
            First match wins. Path is the part after <code>/hook/{mock.slug}</code>; <code>*</code> matches anything.
            Body placeholders: <code>{'{{body.x.0}}'}</code> <code>{'{{query.x}}'}</code>{' '}
            <code>{'{{headers.x}}'}</code> <code>{'{{uuid}}'}</code> <code>{'{{now}}'}</code>{' '}
            <code>{'{{timestamp}}'}</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
          <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {rules.map((rule, i) => (
        <div key={rule.id} className="border rounded-md p-3 space-y-2 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-5">#{i + 1}</span>
            <Select value={rule.method} onValueChange={(v) => updateRule(i, { method: v as MockMethod })}>
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-7 text-xs font-mono flex-1"
              placeholder="/burn"
              value={rule.path}
              onChange={(e) => updateRule(i, { path: e.target.value })}
            />
            <button type="button" className="p-1 text-slate-400 hover:text-slate-700" onClick={() => move(i, -1)} title="Move up">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="p-1 text-slate-400 hover:text-slate-700" onClick={() => move(i, 1)} title="Move down">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-red-600"
              onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))}
              title="Remove rule"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <ResponseFields value={rule.response} onChange={(response) => updateRule(i, { response })} />
        </div>
      ))}

      <button
        type="button"
        onClick={addRule}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 py-0.5"
      >
        <Plus className="h-3 w-3" />
        Add rule
      </button>

      <div className="border rounded-md p-3 space-y-2">
        <h3 className="text-xs font-semibold text-slate-600">Default response (no rule matched)</h3>
        <ResponseFields value={defaultResponse} onChange={setDefaultResponse} />
      </div>
    </div>
  )
}
