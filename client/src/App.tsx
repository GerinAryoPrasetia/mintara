import React from 'react'
import { RequestBuilder } from './components/RequestBuilder'
import { ResponsePanel } from './components/ResponsePanel'
import { ExportButtons } from './components/ExportButtons'
import { Sidebar } from './components/Sidebar'
import { BulkRequestBuilder } from './components/BulkRequestBuilder'
import { BulkProgressBar } from './components/BulkProgressBar'
import { BulkResultsPanel } from './components/BulkResultsPanel'
import { BulkExportButtons } from './components/BulkExportButtons'
import { useStore } from './store'

export default function App() {
  const { result, error, mode, setMode, isBulkRunning, bulkResults } = useStore()

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Mode toggle */}
        <div className="flex rounded-lg border overflow-hidden w-fit">
          <button
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === 'single'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => setMode('single')}
          >
            Single
          </button>
          <button
            className={`px-4 py-1.5 text-sm font-medium transition-colors border-l ${
              mode === 'bulk'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => setMode('bulk')}
          >
            Bulk
          </button>
        </div>

        {/* Panel 1: Request Builder */}
        {mode === 'single' ? <RequestBuilder /> : <BulkRequestBuilder />}

        {/* Progress bar — only shown during bulk run */}
        {isBulkRunning && <BulkProgressBar />}

        {/* Error state */}
        {error && (
          <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Panel 2: Results */}
        {mode === 'single'
          ? result && <ResponsePanel />
          : <BulkResultsPanel />}

        {/* Panel 3: Action bar — only shown when single-mode results exist */}
        {result && mode === 'single' && (
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-white">
            <span className="text-sm font-medium text-slate-700">Export:</span>
            <ExportButtons />
          </div>
        )}

        {/* Panel 3: Action bar — only shown when bulk-mode results exist and run is complete */}
        {bulkResults.length > 0 && mode === 'bulk' && !isBulkRunning && (
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-white">
            <span className="text-sm font-medium text-slate-700">Export:</span>
            <BulkExportButtons />
          </div>
        )}
      </main>
    </div>
  )
}
