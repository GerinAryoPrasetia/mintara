import React, { useState } from 'react'
import { Download, FileSpreadsheet, Image } from 'lucide-react'
import { Button } from '../components_ui/ui/button'
import { useStore } from '../store'
import { exportJSON, exportExcel, exportPNG } from '../lib/export'
import { compare, normalize } from '@mintara/shared'

export function ExportButtons() {
  const { result, request, singleSummary } = useStore()
  const [exporting, setExporting] = useState<string | null>(null)

  if (!result) return null

  // e.g. "/api/v1/product" → "api-v1-product"
  const pathSlug = request.path.replace(/^\/+/, '').replace(/\//g, '-') || 'export'

  const handleExportJSON = () => {
    exportJSON(request, result, `mintara-${pathSlug}.json`, singleSummary ?? undefined)
  }

  const handleExportExcel = async () => {
    setExporting('excel')
    try {
      const a = result.targets[0]
      const b = result.targets[1]
      const normA = normalize(a.body, request.normalization)
      const normB = normalize(b.body, request.normalization)
      const diffNodes = compare(normA, normB, '')
      await exportExcel(request, result, diffNodes, `mintara-${pathSlug}.xlsx`, singleSummary ?? undefined)
    } finally {
      setExporting(null)
    }
  }

  const handleExportPNG = async () => {
    setExporting('png')
    try {
      await exportPNG('diff-panel', `mintara-${pathSlug}.png`)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={handleExportJSON}>
        <Download className="h-4 w-4 mr-1" />
        Export JSON
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportExcel}
        disabled={exporting === 'excel'}
      >
        <FileSpreadsheet className="h-4 w-4 mr-1" />
        {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPNG}
        disabled={exporting === 'png'}
      >
        <Image className="h-4 w-4 mr-1" />
        {exporting === 'png' ? 'Capturing…' : 'Export PNG'}
      </Button>
    </div>
  )
}
