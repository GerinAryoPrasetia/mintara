import React, { useState } from 'react'
import Editor from '@monaco-editor/react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components_ui/ui/select'
import { Button } from '../../../components_ui/ui/button'
import { Input } from '../../../components_ui/ui/input'
import { Separator } from '../../../components_ui/ui/separator'
import { useApiDiffStore } from '../store'
import { TargetList } from './TargetList'
import { QueryParamsEditor } from './QueryParamsEditor'
import { NormalizationSettings } from './NormalizationSettings'
import type { HttpMethod } from '@mintara/shared'

export function RequestBuilder() {
  const { request, setRequest, runCompare, isLoading } = useApiDiffStore()
  const [bodyError, setBodyError] = useState<string | null>(null)

  const handleBodyChange = (value: string | undefined) => {
    if (!value) {
      setRequest({ body: undefined })
      setBodyError(null)
      return
    }
    try {
      const parsed = JSON.parse(value)
      setRequest({ body: parsed })
      setBodyError(null)
    } catch {
      setBodyError('Invalid JSON')
    }
  }

  const showBody = request.method === 'POST' || request.method === 'PUT'

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white">
      <h2 className="text-lg font-semibold text-slate-800">Request Builder</h2>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700 shrink-0">Method</label>
        <Select
          value={request.method}
          onValueChange={(v) => setRequest({ method: v as HttpMethod })}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['GET', 'POST', 'PUT', 'DELETE'] as HttpMethod[]).map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="flex-1"
          placeholder="/api/v1/product"
          value={request.path}
          onChange={(e) => setRequest({ path: e.target.value })}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Query Params</label>
        <QueryParamsEditor
          path={request.path}
          onChange={(path) => setRequest({ path })}
        />
      </div>

      <TargetList />

      <Separator />

      {showBody && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-slate-700">Body (JSON)</label>
            {bodyError && <span className="text-xs text-red-500">{bodyError}</span>}
          </div>
          <div className="border rounded overflow-hidden" style={{ height: 160 }}>
            <Editor
              height="160px"
              defaultLanguage="json"
              defaultValue="{}"
              value={request.body ? JSON.stringify(request.body, null, 2) : '{}'}
              onChange={handleBodyChange}
              options={{ minimap: { enabled: false }, lineNumbers: 'off', scrollBeyondLastLine: false }}
            />
          </div>
        </div>
      )}

      <Separator />

      <NormalizationSettings />

      <Button
        className="w-full"
        onClick={runCompare}
        disabled={isLoading || !request.path || request.targets.some((t) => !t.baseUrl)}
      >
        {isLoading ? 'Comparing…' : 'Compare'}
      </Button>
    </div>
  )
}
