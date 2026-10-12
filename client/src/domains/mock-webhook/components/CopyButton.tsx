import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export function CopyButton({ text, label = 'Copy', title }: { text: string; label?: string; title?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable (non-secure context); nothing useful to do
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={title ?? label}
      className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shrink-0"
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : label}
    </button>
  )
}
