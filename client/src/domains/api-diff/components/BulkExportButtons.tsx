import React, { useState } from 'react'
import { Download, FileSpreadsheet, Image } from 'lucide-react'
import { Button } from '../../../components_ui/ui/button'
import { useApiDiffStore } from '../store'
import { exportBulkJSON, exportBulkExcel, exportPNG } from '../export'

export function BulkExportButtons() {
  const { bulkResults, isBulkRunning, bulkItemSummaries, bulkAggregateSummary, activeCaseName, request } = useApiDiffStore()
  const [exporting, setExporting] = useState<string | null>(null)

  if (bulkResults.length === 0 || isBulkRunning) return null

  const hasSummaries = Object.keys(bulkItemSummaries).length > 0
  const baseName = (activeCaseName ?? 'mintara-bulk').replace(/[^a-zA-Z0-9-_]/g, '-')

  const handleExportJSON = async () => {
    setExporting('json')
    try {
      await exportBulkJSON(
        bulkResults,
        `${baseName}.zip`,
        hasSummaries ? bulkItemSummaries : undefined,
        bulkAggregateSummary ?? undefined,
      )
    } finally {
      setExporting(null)
    }
  }

  const handleExportExcel = async () => {
    setExporting('excel')
    try {
      await exportBulkExcel(
        bulkResults,
        request.normalization,
        `${baseName}.xlsx`,
        hasSummaries ? bulkItemSummaries : undefined,
        bulkAggregateSummary ?? undefined,
      )
    } finally {
      setExporting(null)
    }
  }

  const handleExportPNG = async () => {
    setExporting('png')
    try {
      await exportPNG('bulk-results-panel', `${baseName}.png`)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={handleExportJSON} disabled={exporting === 'json'}>
        <Download className="h-4 w-4 mr-1" />
        {exporting === 'json' ? 'Zipping…' : 'Export JSON'}
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
