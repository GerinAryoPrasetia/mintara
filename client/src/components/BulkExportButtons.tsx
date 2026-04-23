import React, { useState } from 'react'
import { Download, FileSpreadsheet, Image } from 'lucide-react'
import { Button } from '../components_ui/ui/button'
import { useStore } from '../store'
import { exportBulkJSON, exportBulkExcel, exportPNG } from '../lib/export'

export function BulkExportButtons() {
  const { bulkResults, isBulkRunning } = useStore()
  const [exporting, setExporting] = useState<string | null>(null)

  if (bulkResults.length === 0 || isBulkRunning) return null

  const handleExportJSON = () => {
    exportBulkJSON(bulkResults, 'mintara-bulk.json')
  }

  const handleExportExcel = async () => {
    setExporting('excel')
    try {
      await exportBulkExcel(bulkResults, 'mintara-bulk.xlsx')
    } finally {
      setExporting(null)
    }
  }

  const handleExportPNG = async () => {
    setExporting('png')
    try {
      await exportPNG('bulk-results-panel', 'mintara-bulk.png')
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
