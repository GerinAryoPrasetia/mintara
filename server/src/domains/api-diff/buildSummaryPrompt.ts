import type { DiffNode } from '@mintara/shared'

export interface TargetInfo {
  name: string
  status: number
  error?: string
}

export interface SummarizeRequest {
  mode: 'single' | 'bulk-item' | 'bulk-aggregate'
  // single / bulk-item
  method?: string
  path?: string
  targetNames?: string[]
  targets?: TargetInfo[]
  diffs?: DiffNode[]
  hasChanges?: boolean
  // bulk-aggregate
  totalItems?: number
  passedItems?: number
  failedItems?: number
  commonDiffPaths?: string[]
}

const INSTRUCTION = 'Summarize in max 2 sentences (under 250 characters). Be direct.'

function buildBulkAggregatePrompt(body: SummarizeRequest): string {
  const paths = (body.commonDiffPaths ?? []).slice(0, 10)
  return `Bulk API migration comparison:
- Total test cases: ${body.totalItems ?? 0}
- Matched (no diffs): ${body.passedItems ?? 0}
- Had differences: ${body.failedItems ?? 0}
${paths.length > 0 ? `\nMost common diff paths:\n${paths.map((p) => `- ${p}`).join('\n')}` : '\nNo differences found across all cases.'}

${INSTRUCTION}`
}

function buildComparisonPrompt(body: SummarizeRequest): string {
  const targets = body.targets ?? []
  const statuses = targets.map((t) => `${t.name}: HTTP ${t.status}${t.error ? ` (${t.error})` : ''}`)
  const statusMismatch = targets.length >= 2 && targets.some((t) => t.status !== targets[0].status)
  const errorTargets = targets.filter((t) => t.status === 0 || t.status >= 400)

  const activeDiffs = (body.diffs ?? []).filter((d) => d.status !== 'equal')
  const diffLines = activeDiffs
    .slice(0, 20)
    .map((d) => {
      if (d.status === 'changed') {
        return `- ${d.path} [changed]: ${JSON.stringify(d.valueA)} → ${JSON.stringify(d.valueB)}`
      }
      return `- ${d.path} [${d.status}]`
    })
    .join('\n')

  const statusSection = statuses.length > 0
    ? `HTTP statuses:\n${statuses.map((s) => `- ${s}`).join('\n')}`
    : ''

  const errorSection = errorTargets.length > 0
    ? `\nErrors:\n${errorTargets.map((t) => `- ${t.name}: ${t.error ?? `HTTP ${t.status}`}`).join('\n')}`
    : ''

  const diffSection = activeDiffs.length > 0
    ? `\nBody differences (${activeDiffs.length} total):\n${diffLines}`
    : '\nBody: identical responses.'

  return `API comparison: ${body.method ?? 'GET'} ${body.path ?? '/'}
${statusSection}${errorSection}
${statusMismatch ? '⚠ Status code mismatch detected — focus on this.' : ''}${diffSection}

${INSTRUCTION}${statusMismatch ? ' Prioritize the HTTP status difference.' : ''}`
}

/** Builds the Ollama user prompt for the given summarize mode. */
export function buildSummaryPrompt(body: SummarizeRequest): string {
  return body.mode === 'bulk-aggregate' ? buildBulkAggregatePrompt(body) : buildComparisonPrompt(body)
}

/** Caps a raw model response to 2 sentences and 250 characters. */
export function truncateSummary(raw: string): string {
  const sentences = raw.trim().match(/[^.!?]*[.!?]+/g) ?? [raw.trim()]
  const twoSentences = sentences.slice(0, 2).join(' ').trim()
  return twoSentences.length > 250 ? twoSentences.slice(0, 247) + '…' : twoSentences
}
