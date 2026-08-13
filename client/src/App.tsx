import React, { useState } from 'react'
import { RequestBuilder } from './domains/api-diff/components/RequestBuilder'
import { ResponsePanel } from './domains/api-diff/components/ResponsePanel'
import { ExportButtons } from './domains/api-diff/components/ExportButtons'
import { Sidebar } from './components/Sidebar'
import { TestCaseSidebar } from './domains/api-diff/components/TestCaseSidebar'
import { FileFinder } from './domains/file-diff/components/FileFinder'
import { DiffChecker } from './domains/file-diff/components/DiffChecker'
import { BulkRequestBuilder } from './domains/api-diff/components/BulkRequestBuilder'
import { BulkProgressBar } from './domains/api-diff/components/BulkProgressBar'
import { BulkResultsPanel } from './domains/api-diff/components/BulkResultsPanel'
import { BulkExportButtons } from './domains/api-diff/components/BulkExportButtons'
import { useApiDiffStore } from './domains/api-diff/store'

type AppPage = 'testcases' | 'diffchecker'

export default function App() {
  const { result, error, mode, setMode, isBulkRunning, bulkResults } = useApiDiffStore()
  const [activePage, setActivePage] = useState<AppPage>('testcases')

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="flex flex-col flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-7xl">
        {activePage === 'testcases' ? (
          <>
            {/* Page header */}
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-slate-800">API Diff Checker</h1>
            </div>

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
          </>
        ) : (
          <>
            {/* Text Diff Checker page */}
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-slate-800">Text Diff Checker</h1>
            </div>
            <div className="flex-1 border rounded-lg bg-white overflow-hidden">
              <DiffChecker />
            </div>
          </>
        )}
      </main>
      {activePage === 'testcases' && <TestCaseSidebar />}
      {activePage === 'diffchecker' && <FileFinder />}
    </div>
  )
}