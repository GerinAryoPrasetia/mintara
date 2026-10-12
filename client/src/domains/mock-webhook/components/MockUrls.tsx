import React from 'react'
import { CopyButton } from './CopyButton'

export function MockUrls({ slug, port }: { slug: string; port: number }) {
  const urls = [
    { label: 'From Docker (php5 / php8-new)', url: `http://host.docker.internal:${port}/hook/${slug}` },
    { label: 'From this machine', url: `http://localhost:${port}/hook/${slug}` },
  ]

  return (
    <div className="border rounded-lg bg-white p-4 space-y-2">
      <h2 className="text-sm font-semibold text-slate-700">Endpoint URL</h2>
      {urls.map(({ label, url }) => (
        <div key={url} className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-48 shrink-0">{label}</span>
          <code className="flex-1 min-w-0 truncate text-xs font-mono bg-slate-50 border rounded px-2 py-1">{url}</code>
          <CopyButton text={url} />
        </div>
      ))}
      <p className="text-xs text-slate-400">
        Any sub-path and method is accepted, e.g. <code>{`/hook/${slug}/burn`}</code>.
      </p>
    </div>
  )
}
