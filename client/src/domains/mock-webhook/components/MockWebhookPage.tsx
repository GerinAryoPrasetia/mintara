import React, { useEffect } from 'react'
import { useMockWebhookStore } from '../store'
import { MockUrls } from './MockUrls'
import { MockRulesEditor } from './MockRulesEditor'
import { RequestLog } from './RequestLog'

export function MockWebhookPage() {
  const { mocks, selectedSlug, port, error, init, setError } = useMockWebhookStore()

  useEffect(() => {
    init()
  }, [init])

  const mock = mocks.find((m) => m.slug === selectedSlug)

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Mock Webhook</h1>
      </div>

      {error && (
        <div className="flex items-start justify-between p-4 border border-red-200 rounded-lg bg-red-50 text-red-700 text-sm">
          <span>
            <strong>Error:</strong> {error}
          </span>
          <button type="button" className="text-xs underline" onClick={() => setError(null)}>
            dismiss
          </button>
        </div>
      )}

      {mock ? (
        <>
          <MockUrls slug={mock.slug} port={port} />
          {/* Remount on slug change or save so the draft resets to the stored version */}
          <MockRulesEditor key={`${mock.slug}:${mock.updatedAt}`} mock={mock} />
          <RequestLog />
        </>
      ) : (
        <div className="border rounded-lg bg-white p-6 text-sm text-slate-500">
          Create a mock, or import one from a JSON/zip file, in the panel on the right. It will be served at{' '}
          <code>http://localhost:{port}/hook/&lt;slug&gt;</code>.
        </div>
      )}
    </>
  )
}
