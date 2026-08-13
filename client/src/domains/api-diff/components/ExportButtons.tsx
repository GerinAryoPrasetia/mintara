import React, { useState } from 'react'
import { Download, FileSpreadsheet, Image } from 'lucide-react'
import { Button } from '../../../components_ui/ui/button'
import { useApiDiffStore } from '../store'
import { exportJSON, exportExcel, exportPNG } from '../export'
import { diffTargets } from '../diff'

export function ExportButtons() {
  const { result, request, singleSummary, activeCaseName } = useApiDiffStore()
  const [exporting, setExporting] = useState<string | null>(null)

  if (!result) return null

  const baseName = activeCaseName
    ? activeCaseName.replace(/[^a-zA-Z0-9-_]/g, '-')
    : (request.path.replace(/^\/+/, '').replace(/\//g, '-') || 'export')

  const handleExportJSON = () => {
    exportJSON(request, result, `${baseName}.json`, singleSummary ?? undefined)
  }

  const handleExportExcel = async () => {
    setExporting('excel')
    try {
      const a = result.targets[0]
      const b = result.targets[1]
      const diffNodes = diffTargets(a.body, b.body, request.normalization)
      await exportExcel(request, result, diffNodes, `${baseName}.xlsx`, singleSummary ?? undefined)
    } finally {
      setExporting(null)
    }
  }

  const handleExportPNG = async () => {
    setExporting('png')
    try {
      await exportPNG('diff-panel', `${baseName}.png`)
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
