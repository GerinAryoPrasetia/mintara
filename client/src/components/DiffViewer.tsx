import React, { useMemo } from 'react'
import ReactDiffViewerLib from 'react-diff-viewer-continued'
const ReactDiffViewer = (ReactDiffViewerLib as any).default ?? ReactDiffViewerLib
import { Badge } from '../components_ui/ui/badge'
import { compare, normalize } from '@mintara/shared'
import type { TargetResult, NormalizationOptions, DiffNode } from '@mintara/shared'

interface DiffViewerProps {
  targetA: TargetResult
  targetB: TargetResult
  normalization: NormalizationOptions
}

const STATUS_COLORS: Record<string, string> = {
  changed: 'bg-yellow-100 text-yellow-800',
  added: 'bg-green-100 text-green-800',
  removed: 'bg-red-100 text-red-800',
}

export function DiffViewer({ targetA, targetB, normalization }: DiffViewerProps) {
  const diffNodes: DiffNode[] = useMemo(() => {
    const normA = normalize(targetA.body, normalization)
    const normB = normalize(targetB.body, normalization)
    return compare(normA, normB, '').filter((n) => n.status !== 'equal')
  }, [targetA, targetB, normalization])

  const aText = JSON.stringify(targetA.body, null, 2) ?? ''
  const bText = JSON.stringify(targetB.body, null, 2) ?? ''
  const fullDiffTooLarge = aText.length + bText.length > 100_000

  return (
    <div className="space-y-4">
      {/* DiffNode summary table */}
      {diffNodes.length === 0 ? (
        <div className="text-center py-6 text-green-600 font-medium">
          No differences found — responses are identical after normalization.
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto max-h-64">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left p-2 font-medium text-slate-600 w-[30%]">Path</th>
                <th className="text-left p-2 font-medium text-slate-600 w-[15%]">Status</th>
                <th className="text-left p-2 font-medium text-slate-600 w-[27.5%]">Value A</th>
                <th className="text-left p-2 font-medium text-slate-600 w-[27.5%]">Value B</th>
              </tr>
            </thead>
            <tbody>
              {diffNodes.map((node, i) => (
                <tr key={i} className="border-t hover:bg-slate-50">
                  <td className="p-2 font-mono text-xs text-slate-700 break-all">{node.path}</td>
                  <td className="p-2">
                    <Badge className={`text-xs ${STATUS_COLORS[node.status] ?? ''}`}>
                      {node.status}
                    </Badge>
                  </td>
                  <td className="p-2 font-mono text-xs text-slate-600 break-all align-top">
                    {node.valueA !== undefined ? JSON.stringify(node.valueA) : '—'}
                  </td>
                  <td className="p-2 font-mono text-xs text-slate-600 break-all align-top">
                    {node.valueB !== undefined ? JSON.stringify(node.valueB) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Side-by-side full diff */}
      {fullDiffTooLarge ? (
        <div className="border rounded-lg px-4 py-3 text-xs text-slate-500 bg-slate-50">
          Full diff hidden — response too large ({Math.round((aText.length + bText.length) / 1024)}KB combined). Use the table above for field-level differences.
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto text-xs">
          <ReactDiffViewer
            oldValue={aText}
            newValue={bText}
            splitView={true}
            leftTitle={targetA.name}
            rightTitle={targetB.name}
            useDarkTheme={false}
          />
        </div>
      )}
    </div>
  )
}
