import React, { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components_ui/ui/tabs'
import { Badge } from '../../../components_ui/ui/badge'
import { Button } from '../../../components_ui/ui/button'
import { useApiDiffStore } from '../store'
import { DiffViewer } from './DiffViewer'

/** Generate all pairwise combinations from an array */
function pairwise<T>(arr: T[]): [T, T][] {
  const pairs: [T, T][] = []
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      pairs.push([arr[i], arr[j]])
    }
  }
  return pairs
}

export function ResponsePanel() {
  const { result, request, singleSummary, singleSummaryLoading, generateSingleSummary } = useApiDiffStore()
  const [activePair, setActivePair] = useState<string>('0-1')
  const [summaryExpanded, setSummaryExpanded] = useState(false)

  if (!result) return null

  const { targets: targetResults } = result
  const pairs = pairwise(targetResults)

  const statusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-green-100 text-green-800'
    if (status >= 400) return 'bg-red-100 text-red-800'
    if (status === 0) return 'bg-slate-100 text-slate-600'
    return 'bg-yellow-100 text-yellow-800'
  }

  const handleSummarize = async () => {
    setSummaryExpanded(true)
    await generateSingleSummary()
  }

  return (
    <div id="diff-panel" className="space-y-4 p-4 border rounded-lg bg-white">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold text-slate-800">
          Results
          {result.hasChanges ? (
            <Badge className="ml-2 bg-yellow-100 text-yellow-800">Changes Detected</Badge>
          ) : (
            <Badge className="ml-2 bg-green-100 text-green-800">Identical</Badge>
          )}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSummarize}
          disabled={singleSummaryLoading}
        >
          <Sparkles className="h-4 w-4 mr-1" />
          {singleSummaryLoading ? 'Summarizing…' : 'AI Summary'}
        </Button>
      </div>

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

      {/* AI Summary card */}
      {(singleSummary || singleSummaryLoading) && (
        <div className="border rounded-md bg-purple-50 border-purple-200">
          <button
            type="button"
            onClick={() => setSummaryExpanded((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-purple-800"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Summary
            <span className="ml-auto text-xs text-purple-400">{summaryExpanded ? '▲' : '▼'}</span>
          </button>
          {summaryExpanded && (
            <div className="px-3 pb-3">
              {singleSummaryLoading ? (
                <p className="text-sm text-purple-600 italic">Generating summary…</p>
              ) : (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{singleSummary}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pairwise diff tabs */}
      {pairs.length === 1 ? (
        <DiffViewer
          targetA={targetResults[0]}
          targetB={targetResults[1]}
          normalization={request.normalization}
        />
      ) : (
        <Tabs value={activePair} onValueChange={setActivePair}>
          <TabsList>
            {pairs.map(([a, b], idx) => {
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
                  normalization={request.normalization}
                />
              </TabsContent>
            )
          })}
        </Tabs>
      )}
    </div>
  )
}
