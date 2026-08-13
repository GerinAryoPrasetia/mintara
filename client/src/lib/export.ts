import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import html2canvas from 'html2canvas'
import type { CompareRequest, CompareResult, DiffNode, BulkItemResult, BulkRequestItem } from '@mintara/shared'
import { compare, normalize } from '@mintara/shared'

export function exportJSON(
  request: CompareRequest,
  result: CompareResult,
  filename = 'mintara-result.json',
  aiSummary?: string,
): void {
  const payload: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    request,
    result,
  }
  if (aiSummary) payload.aiSummary = aiSummary
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  triggerDownload(blob, filename)
}

export async function exportExcel(
  request: CompareRequest,
  result: CompareResult,
  diffNodes: DiffNode[],
  filename = 'mintara-diff.xlsx',
  aiSummary?: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook()

  // ── Sheet 1: Request ────────────────────────────────────────────────────────
  const reqSheet = workbook.addWorksheet('Request')
  reqSheet.columns = [
    { key: 'field', width: 20 },
    { key: 'value', width: 60 },
  ]

  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
  const sectionFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }

  const addReqRow = (field: string, value: string, bold = false) => {
    const row = reqSheet.addRow({ field, value })
    if (bold) row.font = { bold: true }
    return row
  }

  addReqRow('Method', request.method, true)
  addReqRow('Body', request.body ? JSON.stringify(request.body, null, 2) : '(none)')
  addReqRow('Ignore Fields', request.normalization.ignoreFields.join(', ') || '(none)')
  addReqRow('Sort Arrays', request.normalization.sortArrays ? 'Yes' : 'No')

  reqSheet.addRow({})

  request.targets.forEach((target, i) => {
    const sectionRow = reqSheet.addRow({ field: `Target ${i + 1}`, value: '' })
    sectionRow.font = { bold: true }
    sectionRow.fill = sectionFill

    addReqRow('Name', target.name)
    addReqRow('Base URL', target.baseUrl)
    addReqRow('Path', request.path)
    addReqRow('Headers', Object.keys(target.headers).length > 0 ? JSON.stringify(target.headers, null, 2) : '(none)')
    reqSheet.addRow({})
  })

  // ── Sheet 2: Diff ───────────────────────────────────────────────────────────
  const targetNames = result.targets.map((t) => t.name)
  const nameA = targetNames[0] ?? 'A'
  const nameB = targetNames[1] ?? 'B'

  const diffSheet = workbook.addWorksheet('Diff')
  diffSheet.columns = [
    { header: 'Path', key: 'path', width: 40 },
    { header: 'Status', key: 'status', width: 12 },
    { header: `Value (${nameA})`, key: 'valueA', width: 35 },
    { header: `Value (${nameB})`, key: 'valueB', width: 35 },
  ]

  diffSheet.getRow(1).font = { bold: true }
  diffSheet.getRow(1).fill = headerFill

  const STATUS_FILL: Record<string, string> = {
    changed: 'FFFEF08A',
    added:   'FFD1FAE5',
    removed: 'FFFEE2E2',
    equal:   'FFFFFFFF',
  }

  for (const node of diffNodes) {
    const row = diffSheet.addRow({
      path: node.path,
      status: node.status,
      valueA: node.valueA !== undefined ? JSON.stringify(node.valueA) : '',
      valueB: node.valueB !== undefined ? JSON.stringify(node.valueB) : '',
    })
    const fillColor = STATUS_FILL[node.status] ?? 'FFFFFFFF'
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
    })
  }

  // ── Sheet 3: Responses ──────────────────────────────────────────────────────
  const respSheet = workbook.addWorksheet('Responses')
  respSheet.columns = [
    { header: 'Target', key: 'name', width: 20 },
    { header: 'URL', key: 'url', width: 45 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Error', key: 'error', width: 30 },
    { header: 'Body', key: 'body', width: 80 },
  ]

  respSheet.getRow(1).font = { bold: true }
  respSheet.getRow(1).fill = headerFill

  for (const target of result.targets) {
    const row = respSheet.addRow({
      name: target.name,
      url: target.url,
      status: target.status,
      error: target.error ?? '',
      body: target.body !== null ? JSON.stringify(target.body, null, 2) : '',
    })
    // Wrap body cell so long JSON is readable
    row.getCell('body').alignment = { wrapText: true, vertical: 'top' }
    row.height = 60
  }

  // ── Sheet 4: AI Summary (optional) ─────────────────────────────────────────
  if (aiSummary) {
    const summarySheet = workbook.addWorksheet('AI Summary')
    summarySheet.columns = [{ key: 'summary', width: 100 }]
    const cell = summarySheet.getCell('A1')
    cell.value = aiSummary
    cell.alignment = { wrapText: true, vertical: 'top' }
    summarySheet.getRow(1).height = Math.max(60, aiSummary.split('\n').length * 15)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  triggerDownload(blob, filename)
}

export async function exportPNG(
  elementId = 'diff-panel',
  filename = 'mintara-diff.png',
): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) throw new Error(`Element #${elementId} not found`)

  const canvas = await html2canvas(element, { useCORS: true, scale: 2 })
  canvas.toBlob((blob) => {
    if (!blob) return
    triggerDownload(blob, filename)
  }, 'image/png')
}

export async function exportBulkJSON(
  bulkResults: BulkItemResult[],
  filename = 'mintara-bulk.zip',
  bulkItemSummaries?: Record<string, string>,
  aggregateSummary?: string,
): Promise<void> {
  const zip = new JSZip()
  const exportedAt = new Date().toISOString()

  bulkResults.forEach((r, i) => {
    const payload = {
      exportedAt,
      ...r,
      ...(bulkItemSummaries?.[r.item.id] ? { aiSummary: bulkItemSummaries[r.item.id] } : {}),
    }
    zip.file(bulkItemFilename(r.item, i), JSON.stringify(payload, null, 2))
  })

  if (aggregateSummary) {
    zip.file('_aggregate-summary.json', JSON.stringify({ exportedAt, aggregateSummary }, null, 2))
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, filename)
}

function bulkItemFilename(item: BulkRequestItem, index: number): string {
  const slug = item.path.replace(/^\/+/, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '')
  const order = String(index + 1).padStart(3, '0')
  return `${order}-${item.method}-${slug || 'root'}.json`
}

export async function exportBulkExcel(
  bulkResults: BulkItemResult[],
  filename = 'mintara-bulk.xlsx',
  bulkItemSummaries?: Record<string, string>,
  aggregateSummary?: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }

  // ── Sheet 1: Summary ───────────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Summary')
  const doneResults = bulkResults.filter((r) => r.status === 'done' && r.result)
  const targetNames = doneResults[0]?.result?.targets.map((t) => t.name) ?? []

  summarySheet.columns = [
    { header: 'Method', key: 'method', width: 10 },
    { header: 'Path', key: 'path', width: 45 },
    { header: 'Body', key: 'body', width: 40 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Matched?', key: 'matched', width: 12 },
    ...targetNames.map((name) => ({ header: `${name} HTTP`, key: `${name}_http`, width: 12 })),
    { header: 'Error', key: 'error', width: 40 },
    ...(bulkItemSummaries ? [{ header: 'AI Summary', key: 'aiSummary', width: 60 }] : []),
  ]

  summarySheet.getRow(1).font = { bold: true }
  summarySheet.getRow(1).fill = headerFill

  const STATUS_FILL: Record<string, string> = {
    done: 'FFFFFFFF',
    error: 'FFFEE2E2',
    pending: 'FFF1F5F9',
    running: 'FFF1F5F9',
  }

  for (const entry of bulkResults) {
    const rowData: Record<string, string | number> = {
      method: entry.item.method,
      path: entry.item.path,
      body: entry.item.body ? JSON.stringify(entry.item.body) : '',
      status: entry.status,
      matched: entry.result ? (entry.result.hasChanges ? 'Diffs' : 'Matched') : '-',
      error: entry.error ?? '',
      ...(bulkItemSummaries ? { aiSummary: bulkItemSummaries[entry.item.id] ?? '' } : {}),
    }
    for (const target of entry.result?.targets ?? []) {
      rowData[`${target.name}_http`] = target.status
    }
    const row = summarySheet.addRow(rowData)
    const fillColor = entry.result?.hasChanges ? 'FFFEF08A' : STATUS_FILL[entry.status] ?? 'FFFFFFFF'
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
    })
  }

  // ── Sheet 2: Diffs ─────────────────────────────────────────────────────────
  const diffsSheet = workbook.addWorksheet('Diffs')
  diffsSheet.columns = [
    { header: 'Request', key: 'request', width: 35 },
    { header: 'Diff Path', key: 'diffPath', width: 40 },
    { header: 'Status', key: 'diffStatus', width: 12 },
    { header: 'Value A', key: 'valueA', width: 35 },
    { header: 'Value B', key: 'valueB', width: 35 },
  ]
  diffsSheet.getRow(1).font = { bold: true }
  diffsSheet.getRow(1).fill = headerFill

  const DIFF_FILL: Record<string, string> = {
    changed: 'FFFEF08A',
    added: 'FFD1FAE5',
    removed: 'FFFEE2E2',
    equal: 'FFFFFFFF',
  }

  for (const entry of bulkResults) {
    if (entry.status !== 'done' || !entry.result) continue
    const { targets } = entry.result
    if (targets.length < 2) continue
    const normA = normalize(targets[0].body, { ignoreFields: [], sortArrays: false })
    const normB = normalize(targets[1].body, { ignoreFields: [], sortArrays: false })
    const nodes = compare(normA, normB, '')
    for (const node of nodes) {
      if (node.status === 'equal') continue
      const row = diffsSheet.addRow({
        request: `${entry.item.method} ${entry.item.path}`,
        diffPath: node.path,
        diffStatus: node.status,
        valueA: node.valueA !== undefined ? JSON.stringify(node.valueA) : '',
        valueB: node.valueB !== undefined ? JSON.stringify(node.valueB) : '',
      })
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DIFF_FILL[node.status] ?? 'FFFFFFFF' } }
      })
    }
  }

  // ── Sheet 3: AI Aggregate Summary (optional) ───────────────────────────────
  if (aggregateSummary) {
    const aggSheet = workbook.addWorksheet('AI Aggregate Summary')
    aggSheet.columns = [{ key: 'summary', width: 100 }]
    const cell = aggSheet.getCell('A1')
    cell.value = aggregateSummary
    cell.alignment = { wrapText: true, vertical: 'top' }
    aggSheet.getRow(1).height = Math.max(60, aggregateSummary.split('\n').length * 15)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  triggerDownload(blob, filename)
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
