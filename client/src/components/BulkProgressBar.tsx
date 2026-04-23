import React from 'react'
import { Button } from '../components_ui/ui/button'
import { useStore } from '../store'

export function BulkProgressBar() {
  const { bulkProgress, isBulkRunning, bulkResults, stopBulk } = useStore()

  // If bulk is not running and no progress, render nothing
  if (!isBulkRunning && bulkProgress === null) {
    return null
  }

  // Get the running item for the label
  const runningItem = bulkResults.find((r) => r.status === 'running')
  const current = bulkProgress?.current ?? 0
  const total = bulkProgress?.total ?? 0
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0

  const labelText = runningItem
    ? `Requesting ${current} / ${total} — ${runningItem.item.method} ${runningItem.item.path}`
    : `Requesting ${current} / ${total}`

  return (
    <div className="space-y-2 p-4 border rounded-lg bg-white">
      {/* Label and Stop button row */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-800">{labelText}</span>
        <Button
          size="sm"
          variant="destructive"
          onClick={stopBulk}
          disabled={!isBulkRunning}
        >
          Stop
        </Button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 rounded h-6 overflow-hidden flex items-center relative">
        <div
          className="bg-blue-500 h-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-medium text-slate-800">
          {percentage}%
        </span>
      </div>
    </div>
  )
}
