import React from 'react'
import { RequestBuilder } from './components/RequestBuilder'
import { ResponsePanel } from './components/ResponsePanel'
import { ExportButtons } from './components/ExportButtons'
import { TestCaseManager } from './components/TestCaseManager'
import { BulkRequestBuilder } from './components/BulkRequestBuilder'
import { BulkProgressBar } from './components/BulkProgressBar'
import { BulkResultsPanel } from './components/BulkResultsPanel'
import { BulkExportButtons } from './components/BulkExportButtons'
import { useStore } from './store'

export default function App() {
  const { result, error, mode, setMode, isBulkRunning, bulkResults } = useStore()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">mintara</h1>
          <p className="text-xs text-slate-500">API Response Comparison Tool</p>
        </div>
        <TestCaseManager />
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
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
