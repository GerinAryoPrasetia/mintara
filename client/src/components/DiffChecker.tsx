import React, { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Columns, AlignJustify } from 'lucide-react'
import { Button } from '../components_ui/ui/button'
import { Checkbox } from '../components_ui/ui/checkbox'
import { Separator } from '../components_ui/ui/separator'
import { useStore } from '../store'

interface DiffLine {
  lineNumber: string
  content: string
  type: 'added' | 'removed' | 'unchanged' | 'modified'
}

function computeLineByLineDiff(oldText: string, newText: string): { left: DiffLine[], right: DiffLine[], hasDiff: boolean } {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const left: DiffLine[] = []
  const right: DiffLine[] = []
  let hasDiff = false

  // Simple LCS-based diff algorithm
  const m = oldLines.length
  const n = newLines.length

  // Build LCS matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to find diff
  let i = m, j = n
  const ops: { op: 'equal' | 'delete' | 'insert', oldIdx?: number, newIdx?: number }[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ op: 'equal', oldIdx: i - 1, newIdx: j - 1 })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ op: 'insert', newIdx: j - 1 })
      j--
    } else {
      ops.unshift({ op: 'delete', oldIdx: i - 1 })
      i--
    }
  }

  let leftLineNum = 1
  let rightLineNum = 1

  for (const op of ops) {
    if (op.op === 'equal') {
      left.push({ lineNumber: String(leftLineNum++), content: oldLines[op.oldIdx!], type: 'unchanged' })
      right.push({ lineNumber: String(rightLineNum++), content: newLines[op.newIdx!], type: 'unchanged' })
    } else if (op.op === 'delete') {
      left.push({ lineNumber: String(leftLineNum++), content: oldLines[op.oldIdx!], type: 'removed' })
      right.push({ lineNumber: '', content: '', type: 'removed' })
      hasDiff = true
    } else if (op.op === 'insert') {
      left.push({ lineNumber: '', content: '', type: 'added' })
      right.push({ lineNumber: String(rightLineNum++), content: newLines[op.newIdx!], type: 'added' })
      hasDiff = true
    }
  }

  return { left, right, hasDiff }
}

function computeUnifiedDiff(oldText: string, newText: string): { lines: DiffLine[], hasDiff: boolean } {
  const { left, right } = computeLineByLineDiff(oldText, newText)
  const lines: DiffLine[] = []
  let hasDiff = false

  const maxLen = Math.max(left.length, right.length)
  for (let i = 0; i < maxLen; i++) {
    const l = left[i]
    const r = right[i]

    if (l && r && l.type === 'unchanged' && r.type === 'unchanged') {
      lines.push(l)
    } else {
      hasDiff = true
      if (l && l.type !== 'added') {
        lines.push(l)
      }
      if (r && r.type !== 'removed') {
        lines.push(r)
      }
    }
  }

  return { lines, hasDiff }
}

export function DiffChecker() {
  const {
    diffOriginalText: leftText,
    setDiffOriginalText: setLeftText,
    diffModifiedText: rightText,
    setDiffModifiedText: setRightText,
  } = useStore()
  const [hideWhitespace, setHideWhitespace] = useState(false)
  const [hideUnchanged, setHideUnchanged] = useState(false)
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split')

  const processedLeft = useMemo(() => {
    return hideWhitespace ? leftText.split('\n').map(l => l.replace(/\s+/g, ' ').trimEnd()).join('\n') : leftText
  }, [leftText, hideWhitespace])

  const processedRight = useMemo(() => {
    return hideWhitespace ? rightText.split('\n').map(l => l.replace(/\s+/g, ' ').trimEnd()).join('\n') : rightText
  }, [rightText, hideWhitespace])

  const diffResult = useMemo(() => {
    if (!processedLeft && !processedRight) return null
    if (viewMode === 'split') {
      return computeLineByLineDiff(processedLeft, processedRight)
    } else {
      return computeUnifiedDiff(processedLeft, processedRight)
    }
  }, [processedLeft, processedRight, viewMode])

  const handleSwap = useCallback(() => {
    setLeftText(rightText)
    setRightText(leftText)
  }, [leftText, rightText])

  const stats = useMemo(() => {
    if (!diffResult) return { added: 0, removed: 0, changed: 0 }
    if (viewMode === 'split') {
      const result = diffResult as { left: DiffLine[], right: DiffLine[], hasDiff: boolean }
      const added = result.right.filter(l => l.type === 'added').length
      const removed = result.left.filter(l => l.type === 'removed').length
      return { added, removed, changed: 0 }
    } else {
      const result = diffResult as { lines: DiffLine[], hasDiff: boolean }
      const added = result.lines.filter(l => l.type === 'added').length
      const removed = result.lines.filter(l => l.type === 'removed').length
      return { added, removed, changed: 0 }
    }
  }, [diffResult, viewMode])

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {/* Options bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <Checkbox
            id="hide-ws"
            checked={hideWhitespace}
            onCheckedChange={(v) => setHideWhitespace(!!v)}
          />
          <label htmlFor="hide-ws" className="text-xs cursor-pointer select-none text-slate-600">
            Hide whitespace
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="hide-unchanged"
            checked={hideUnchanged}
            onCheckedChange={(v) => setHideUnchanged(!!v)}
          />
          <label htmlFor="hide-unchanged" className="text-xs cursor-pointer select-none text-slate-600">
            Hide unchanged lines
          </label>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            size="sm"
            variant={viewMode === 'split' ? 'default' : 'outline'}
            className="h-7 text-xs px-2"
            onClick={() => setViewMode('split')}
            title="Split view"
          >
            <Columns className="h-3.5 w-3.5 mr-1" /> Split
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'unified' ? 'default' : 'outline'}
            className="h-7 text-xs px-2"
            onClick={() => setViewMode('unified')}
            title="Unified view"
          >
            <AlignJustify className="h-3.5 w-3.5 mr-1" /> Unified
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      {diffResult && diffResult.hasDiff && (
        <div className="px-4 py-2 border-b border-slate-100 shrink-0 flex items-center gap-4 text-xs">
          <span className="text-green-600 font-medium">+{stats.added} added</span>
          <span className="text-red-600 font-medium">-{stats.removed} removed</span>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Input panels */}
        <div className="flex min-h-0 h-1/2 shrink-0 border-b border-slate-200">
          {/* Left input */}
          <div className="flex flex-col flex-1 min-w-0 border-r border-slate-200">
            <div className="px-3 py-2 text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200 shrink-0">Original</div>
            <textarea
              value={leftText}
              onChange={(e) => setLeftText(e.target.value)}
              placeholder="Paste original text here..."
              className="flex-1 min-h-0 p-3 text-sm font-mono resize-none border-0 focus:ring-0 focus:outline-none"
              spellCheck={false}
            />
          </div>
          {/* Right input */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="px-3 py-2 text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200 shrink-0">Modified</div>
            <textarea
              value={rightText}
              onChange={(e) => setRightText(e.target.value)}
              placeholder="Paste modified text here..."
              className="flex-1 min-h-0 p-3 text-sm font-mono resize-none border-0 focus:ring-0 focus:outline-none"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Diff output panel */}
        <div className="flex flex-col flex-1 min-h-0 bg-slate-50">
          <div className="px-3 py-2 text-xs font-medium text-slate-500 bg-slate-100 border-b border-slate-200 shrink-0">Diff Output</div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {(!leftText && !rightText) ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">
                Enter text to see differences
              </div>
            ) : diffResult && !diffResult.hasDiff ? (
              <div className="flex items-center justify-center h-full text-sm text-green-600 font-medium">
                No differences found
              </div>
            ) : diffResult && diffResult.hasDiff ? (
              <div className="text-sm">
                {viewMode === 'split' ? (
                  <SplitDiffView
                    leftLines={(diffResult as { left: DiffLine[], right: DiffLine[], hasDiff: boolean }).left}
                    rightLines={(diffResult as { left: DiffLine[], right: DiffLine[], hasDiff: boolean }).right}
                    hideUnchanged={hideUnchanged}
                  />
                ) : (
                  <UnifiedDiffView
                    lines={(diffResult as { lines: DiffLine[], hasDiff: boolean }).lines}
                    hideUnchanged={hideUnchanged}
                  />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-200 shrink-0">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleSwap}>
          Swap Left / Right
        </Button>
      </div>
    </div>
  )
}

function SplitDiffView({ leftLines, rightLines, hideUnchanged }: { leftLines: DiffLine[], rightLines: DiffLine[], hideUnchanged: boolean }) {
  const filteredLeft = hideUnchanged ? leftLines.filter(l => l.type !== 'unchanged') : leftLines
  const filteredRight = hideUnchanged ? rightLines.filter(l => l.type !== 'unchanged') : rightLines

  return (
    <div className="flex min-h-full">
      <div className="flex-1 min-w-0">
        {filteredLeft.map((line, i) => (
          <div
            key={`l-${i}`}
            className={`flex min-h-[28px] ${
              line.type === 'removed' ? 'bg-red-50' :
              line.type === 'unchanged' ? '' : ''
            }`}
          >
            <span className="w-12 shrink-0 text-right pr-3 text-slate-400 select-none border-r border-slate-200 bg-slate-100">
              {line.lineNumber}
            </span>
            <span className={`pl-3 pr-2 flex-1 break-all whitespace-pre-wrap ${
              line.type === 'removed' ? 'text-red-700 bg-red-50' : 'text-slate-700'
            }`}>
              {line.content}
            </span>
          </div>
        ))}
      </div>
      <div className="flex-1 min-w-0 border-l border-slate-200">
        {filteredRight.map((line, i) => (
          <div
            key={`r-${i}`}
            className={`flex min-h-[28px] ${
              line.type === 'added' ? 'bg-green-50' :
              line.type === 'unchanged' ? '' : ''
            }`}
          >
            <span className="w-12 shrink-0 text-right pr-3 text-slate-400 select-none border-r border-slate-200 bg-slate-100">
              {line.lineNumber}
            </span>
            <span className={`pl-3 pr-2 flex-1 break-all whitespace-pre-wrap ${
              line.type === 'added' ? 'text-green-700 bg-green-50' : 'text-slate-700'
            }`}>
              {line.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function UnifiedDiffView({ lines, hideUnchanged }: { lines: DiffLine[], hideUnchanged: boolean }) {
  const filtered = hideUnchanged ? lines.filter(l => l.type !== 'unchanged') : lines

  return (
    <div>
      {filtered.map((line, i) => (
        <div
          key={i}
          className={`flex min-h-[28px] ${
            line.type === 'added' ? 'bg-green-50' :
            line.type === 'removed' ? 'bg-red-50' : ''
          }`}
        >
          <span className="w-12 shrink-0 text-right pr-3 text-slate-400 select-none border-r border-slate-200 bg-slate-100">
            {line.lineNumber}
          </span>
          <span className={`w-10 shrink-0 text-center pr-1 pl-1 select-none ${
            line.type === 'added' ? 'text-green-600' :
            line.type === 'removed' ? 'text-red-600' : 'text-slate-400'
          }`}>
            {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
          </span>
          <span className={`pl-1 pr-3 flex-1 break-all whitespace-pre-wrap ${
            line.type === 'added' ? 'text-green-700' :
            line.type === 'removed' ? 'text-red-700' : 'text-slate-700'
          }`}>
            {line.content}
          </span>
        </div>
      ))}
    </div>
  )
}