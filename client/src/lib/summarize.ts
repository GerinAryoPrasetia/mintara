import axios from 'axios'
import type { DiffNode, TargetResult } from '@mintara/shared'

function pickTargetInfo(targets: TargetResult[]) {
  return targets.map((t) => ({ name: t.name, status: t.status, error: t.error }))
}

export async function summarizeSingle(
  method: string,
  path: string,
  targets: TargetResult[],
  diffs: DiffNode[],
  hasChanges: boolean,
): Promise<string> {
  const response = await axios.post<{ summary: string }>('/api/summarize', {
    mode: 'single',
    method,
    path,
    targetNames: targets.map((t) => t.name),
    targets: pickTargetInfo(targets),
    diffs: diffs.filter((d) => d.status !== 'equal'),
    hasChanges,
  })
  return response.data.summary
}

export async function summarizeBulkItem(
  method: string,
  path: string,
  targets: TargetResult[],
  diffs: DiffNode[],
  hasChanges: boolean,
): Promise<string> {
  const response = await axios.post<{ summary: string }>('/api/summarize', {
    mode: 'bulk-item',
    method,
    path,
    targetNames: targets.map((t) => t.name),
    targets: pickTargetInfo(targets),
    diffs: diffs.filter((d) => d.status !== 'equal'),
    hasChanges,
  })
  return response.data.summary
}

export async function summarizeBulkAggregate(
  totalItems: number,
  passedItems: number,
  failedItems: number,
  commonDiffPaths: string[],
): Promise<string> {
  const response = await axios.post<{ summary: string }>('/api/summarize', {
    mode: 'bulk-aggregate',
    totalItems,
    passedItems,
    failedItems,
    commonDiffPaths,
  })
  return response.data.summary
}
