import React, { useState, useEffect } from 'react'
import { Badge } from '../components_ui/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components_ui/ui/tabs'
import { useStore } from '../store'
import { DiffViewer } from './DiffViewer'
import type { CompareResult, NormalizationOptions, BulkItemResult } from '@mintara/shared'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pairwise<T>(arr: T[]): [T, T][] {
  const pairs: [T, T][] = []
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      pairs.push([arr[i], arr[j]])
    }
  }
  return pairs
}

const statusColor = (status: number) => {
  if (status >= 200 && status < 300) return 'bg-green-100 text-green-800'
  if (status >= 400) return 'bg-red-100 text-red-800'
  if (status === 0) return 'bg-slate-100 text-slate-600'
  return 'bg-yellow-100 text-yellow-800'
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-800',
  POST: 'bg-green-100 text-green-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  PATCH: 'bg-orange-100 text-orange-800',
  DELETE: 'bg-red-100 text-red-800',
}

// ---------------------------------------------------------------------------
// ResponsePanelContent — inline version of ResponsePanel, accepting props
// ---------------------------------------------------------------------------

function ResponsePanelContent({
  result,
  normalization,
}: {
  result: CompareResult
  normalization: NormalizationOptions
}) {
  const [activePair, setActivePair] = useState<string>('0-1')

  const { targets: targetResults } = result
  const pairs = pairwise(targetResults)

  return (
    <div className="space-y-4 pt-3">
      {/* Per-target status badges */}
      <div className="flex flex-wrap gap-3">
        {targetResults.map((t) => (
          <div key={t.name} className="flex items-center gap-2 p-2 border rounded-md bg-slate-50">
            <span className="font-medium text-sm">{t.name}</span>
            {t.error ? (
              <Badge className="bg-red-100 text-red-800 text-xs">ERROR: {t.error}</Badge>
            ) : (
              <>
                <Badge className={`text-xs ${statusColor(t.status)}`}>HTTP {t.status}</Badge>
                <Badge className="bg-slate-100 text-slate-600 text-xs">{t.responseTimeMs}ms</Badge>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Pairwise diff tabs */}
      {pairs.length === 0 ? null : pairs.length === 1 ? (
        <DiffViewer
          targetA={targetResults[0]}
          targetB={targetResults[1]}
          normalization={normalization}
        />
      ) : (
        <Tabs value={activePair} onValueChange={setActivePair}>
          <TabsList>
            {pairs.map(([a, b]) => {
              const key = `${targetResults.indexOf(a)}-${targetResults.indexOf(b)}`
              return (
                <TabsTrigger key={key} value={key}>
                  {a.name} vs {b.name}
                </TabsTrigger>
              )
            })}
          </TabsList>
          {pairs.map(([a, b]) => {
            const key = `${targetResults.indexOf(a)}-${targetResults.indexOf(b)}`
            return (
              <TabsContent key={key} value={key}>
                <DiffViewer
                  targetA={a}
                  targetB={b}
                  normalization={normalization}
                />
              </TabsContent>
            )
          })}
        </Tabs>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AccordionCard — one card per BulkItemResult
// ---------------------------------------------------------------------------

function AccordionCard({
  entry,
  normalization,
}: {
  entry: BulkItemResult
  normalization: NormalizationOptions
}) {
  const [expanded, setExpanded] = useState(false)

  // Auto-expand when item transitions away from 'pending'
  useEffect(() => {
    if (entry.status !== 'pending') {
      setExpanded(true)
    }
  }, [entry.status])

  const { item, result, error, status } = entry

  const statusBadge = () => {
    if (status === 'running') {
      return <Badge className="bg-slate-100 text-slate-600 text-xs">Running…</Badge>
    }
    if (status === 'done' && result) {
      return result.hasChanges ? (
        <Badge className="bg-yellow-100 text-yellow-800 text-xs">⚠ Diffs</Badge>
      ) : (
        <Badge className="bg-green-100 text-green-800 text-xs">✓ Matched</Badge>
      )
    }
    if (status === 'error') {
      return <Badge className="bg-red-100 text-red-800 text-xs">✗ Error</Badge>
    }
    // pending
    return <Badge className="bg-slate-100 text-slate-500 text-xs">Pending</Badge>
  }

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* Card header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        {/* Method badge */}
        <Badge
          className={`text-xs font-mono shrink-0 ${METHOD_COLORS[item.method] ?? 'bg-slate-100 text-slate-700'}`}
        >
          {item.method}
        </Badge>

        {/* Path */}
        <span className="flex-1 font-mono text-sm text-slate-700 truncate">{item.path}</span>

        {/* Response time badges (only when done) */}
        {status === 'done' && result && (
          <div className="flex items-center gap-1 shrink-0">
            {result.targets.map((t) => (
              <Badge key={t.name} className="bg-slate-100 text-slate-600 text-xs">
                {t.name}: {t.responseTimeMs}ms
              </Badge>
            ))}
          </div>
        )}

        {/* Status badge */}
        <span className="shrink-0">{statusBadge()}</span>

        {/* Chevron */}
        <span className="text-slate-400 text-xs ml-1 shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Card body */}
      {expanded && (
        <div className="px-4 pb-4 border-t bg-slate-50">
          {status === 'error' && (
            <p className="pt-3 text-sm text-red-700 font-mono">{error ?? 'Unknown error'}</p>
          )}
          {status === 'running' && (
            <p className="pt-3 text-sm text-slate-500 italic">Waiting for response…</p>
          )}
          {status === 'pending' && (
            <p className="pt-3 text-sm text-slate-400 italic">Not yet started.</p>
          )}
          {status === 'done' && result && (
            <ResponsePanelContent result={result} normalization={normalization} />
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// BulkResultsPanel — top-level export
// ---------------------------------------------------------------------------

export function BulkResultsPanel() {
  const { bulkResults, bulkProgress, request } = useStore()

  if (bulkResults.length === 0) return null

  const done = bulkResults.filter((r) => r.status === 'done' || r.status === 'error').length
  const total = bulkProgress ? bulkProgress.total : bulkResults.length
  const matched = bulkResults.filter((r) => r.status === 'done' && r.result?.hasChanges === false).length
  const diffs = bulkResults.filter((r) => r.status === 'done' && r.result?.hasChanges === true).length

  return (
    <div id="bulk-results-panel" className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border rounded-lg text-sm text-slate-700">
        <span className="font-medium">
          {done} / {total} complete
        </span>
        <span className="text-slate-300">|</span>
        <span className="text-green-700">{matched} matched</span>
        <span className="text-slate-300">|</span>
        <span className="text-yellow-700">{diffs} had diffs</span>
      </div>

      {/* Accordion cards */}
      <div className="space-y-2">
        {bulkResults.map((entry) => (
          <AccordionCard
            key={entry.item.id}
            entry={entry}
            normalization={request.normalization}
          />
        ))}
      </div>
    </div>
  )
}
