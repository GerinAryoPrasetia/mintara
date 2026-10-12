import type { CompareRequest, BulkRequestItem } from '@mintara/shared'
import { hasResults } from './caseResults'
import type { CaseResults, CaseResultsCache } from './caseResults'

/** A named, persisted Test Case — see CONTEXT.md. */
export interface SavedCase {
  name: string
  mode: 'single' | 'bulk'
  config: CompareRequest
  // bulk-specific (only present when mode === 'bulk')
  bulkItems?: BulkRequestItem[]
  bulkSharedHeaders?: Record<string, string>
  usePerRequestHeaders?: boolean
}

/**
 * A case as it appears in an export file: the saved config plus, when the
 * case has actually been run, the results that run produced. `results` is
 * export-only — it is never written back into the persisted `SavedCase[]`.
 */
export interface ExportedCase extends SavedCase {
  results?: CaseResults
}

/** Accepted on import: version 1 files carry no `results`, version 2 may. */
export type SavedCasesExportVersion = 1 | 2

export const EXPORT_VERSION = 2

export interface SavedCasesExport {
  version: SavedCasesExportVersion
  exportedAt: string
  cases: ExportedCase[]
}

export function toExportedCase(saved: SavedCase, results: CaseResults): ExportedCase {
  return hasResults(results) ? { ...saved, results } : saved
}

/** Peel `results` off imported cases so only config reaches persisted storage. */
export function splitImported(incoming: ExportedCase[]): {
  cases: SavedCase[]
  results: CaseResultsCache
} {
  const cases: SavedCase[] = []
  const results: CaseResultsCache = {}
  for (const { results: caseResults, ...saved } of incoming) {
    cases.push(saved)
    if (caseResults && hasResults(caseResults)) results[saved.name] = caseResults
  }
  return { cases, results }
}

/** Whatever's currently on screen, saved or not — see CONTEXT.md. */
export interface WorkingCase {
  mode: 'single' | 'bulk'
  request: CompareRequest
  bulkItems: BulkRequestItem[]
  bulkSharedHeaders: Record<string, string>
  usePerRequestHeaders: boolean
}

/**
 * What a caller should apply after loading a case. Single-mode cases don't
 * carry bulk-specific fields, so callers must NOT reset bulk state when
 * loading one (matches the pre-existing behavior of leaving stale bulk
 * state in place until the user switches to Bulk mode).
 */
export type LoadedCase =
  | { mode: 'single'; request: CompareRequest }
  | {
      mode: 'bulk'
      request: CompareRequest
      bulkItems: BulkRequestItem[]
      bulkSharedHeaders: Record<string, string>
      usePerRequestHeaders: boolean
    }

export function toSavedCase(name: string, working: WorkingCase): SavedCase {
  if (working.mode === 'bulk') {
    return {
      name,
      mode: 'bulk',
      config: { ...working.request },
      bulkItems: [...working.bulkItems],
      bulkSharedHeaders: { ...working.bulkSharedHeaders },
      usePerRequestHeaders: working.usePerRequestHeaders,
    }
  }
  return { name, mode: 'single', config: { ...working.request } }
}

export function fromSavedCase(saved: SavedCase): LoadedCase {
  if (saved.mode === 'bulk') {
    return {
      mode: 'bulk',
      request: { ...saved.config },
      bulkItems: saved.bulkItems ? [...saved.bulkItems] : [],
      bulkSharedHeaders: saved.bulkSharedHeaders ? { ...saved.bulkSharedHeaders } : {},
      usePerRequestHeaders: saved.usePerRequestHeaders ?? false,
    }
  }
  return { mode: 'single', request: { ...saved.config } }
}

function autoSaveActive(cases: SavedCase[], activeCaseName: string | null, working: WorkingCase): SavedCase[] {
  if (activeCaseName === null) return cases
  const idx = cases.findIndex((c) => c.name === activeCaseName)
  const entry = toSavedCase(activeCaseName, working)
  if (idx === -1) return [...cases, entry]
  const next = [...cases]
  next[idx] = entry
  return next
}

export function saveCase(
  cases: SavedCase[],
  name: string,
  working: WorkingCase,
): { cases: SavedCase[]; activeCaseName: string } {
  const filtered = cases.filter((c) => c.name !== name)
  return { cases: [...filtered, toSavedCase(name, working)], activeCaseName: name }
}

export function loadCase(cases: SavedCase[], name: string): LoadedCase | null {
  const found = cases.find((c) => c.name === name)
  return found ? fromSavedCase(found) : null
}

export function deleteCase(
  cases: SavedCase[],
  activeCaseName: string | null,
  name: string,
): { cases: SavedCase[]; activeCaseName: string | null } {
  return {
    cases: cases.filter((c) => c.name !== name),
    activeCaseName: activeCaseName === name ? null : activeCaseName,
  }
}

export function switchCase(
  cases: SavedCase[],
  activeCaseName: string | null,
  working: WorkingCase,
  targetName: string,
): { cases: SavedCase[]; activeCaseName: string | null; toLoad: LoadedCase | null } {
  const updatedCases =
    activeCaseName !== null && activeCaseName !== targetName
      ? autoSaveActive(cases, activeCaseName, working)
      : cases
  const found = updatedCases.find((c) => c.name === targetName)
  if (!found) return { cases: updatedCases, activeCaseName, toLoad: null }
  return { cases: updatedCases, activeCaseName: targetName, toLoad: fromSavedCase(found) }
}

export function newCase(
  cases: SavedCase[],
  activeCaseName: string | null,
  working: WorkingCase,
): { cases: SavedCase[]; activeCaseName: null } {
  return { cases: autoSaveActive(cases, activeCaseName, working), activeCaseName: null }
}

export function duplicateCase(cases: SavedCase[], name: string): SavedCase[] {
  const found = cases.find((c) => c.name === name)
  if (!found) return cases
  let copyName = `${name} (copy)`
  let counter = 2
  while (cases.some((c) => c.name === copyName)) {
    copyName = `${name} (copy ${counter++})`
  }
  return [...cases, { ...found, name: copyName }]
}

/**
 * name given + it already names a *different* saved case: switch to it
 * without overwriting its data with the current working state (avoids
 * clobbering an existing case just because the user typed its name).
 * name given otherwise: upsert the working state under that name.
 * no name: save over the active case, if any; a no-op signals the caller
 * should open the save-as dialog instead.
 */
export function saveCurrentCase(
  cases: SavedCase[],
  activeCaseName: string | null,
  working: WorkingCase,
  name?: string,
): { cases: SavedCase[]; activeCaseName: string | null } {
  if (name) {
    const existingCase = cases.find((c) => c.name === name)
    if (existingCase && activeCaseName !== name) {
      return { cases, activeCaseName: name }
    }
    return saveCase(cases, name, working)
  }
  if (activeCaseName !== null) {
    return saveCase(cases, activeCaseName, working)
  }
  return { cases, activeCaseName }
}

export function importCases(
  cases: SavedCase[],
  incoming: SavedCase[],
  resolutions: Record<string, 'overwrite' | 'skip'>,
): SavedCase[] {
  const result = [...cases]
  for (const c of incoming) {
    const idx = result.findIndex((e) => e.name === c.name)
    if (idx === -1) {
      result.push(c)
    } else if (resolutions[c.name] === 'overwrite') {
      result[idx] = c
    }
    // 'skip' or no resolution entry → leave existing untouched
  }
  return result
}

/** One endpoint inside a case that matched a search; `itemId` is set for bulk items. */
export interface EndpointMatch {
  itemId?: string
  method: string
  path: string
}

export interface CaseSearchHit {
  case: SavedCase
  nameMatch: boolean
  endpoints: EndpointMatch[]
}

/**
 * Global search across every saved case: a case is a hit when its name
 * matches, or when any of its endpoints (the single request, or each bulk
 * item) matches by path or by "METHOD path". Only matching endpoints are
 * returned. A blank query returns every case with no endpoint list.
 */
export function searchCases(cases: SavedCase[], query: string): CaseSearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return cases.map((c) => ({ case: c, nameMatch: false, endpoints: [] }))

  const matches = (method: string, path: string) =>
    path.toLowerCase().includes(q) || `${method} ${path}`.toLowerCase().includes(q)

  const hits: CaseSearchHit[] = []
  for (const c of cases) {
    const nameMatch = c.name.toLowerCase().includes(q)
    const endpoints: EndpointMatch[] =
      c.mode === 'bulk'
        ? (c.bulkItems ?? [])
            .filter((item) => matches(item.method, item.path))
            .map((item) => ({ itemId: item.id, method: item.method, path: item.path }))
        : matches(c.config.method, c.config.path)
          ? [{ method: c.config.method, path: c.config.path }]
          : []
    if (nameMatch || endpoints.length > 0) hits.push({ case: c, nameMatch, endpoints })
  }
  return hits
}

export type RenameResult =
  | { ok: true; cases: SavedCase[]; activeCaseName: string | null }
  | { ok: false; error: string }

/**
 * Rename a saved case in place (list order and config untouched). The new
 * name is trimmed; empty names and names already used by another case are
 * rejected. Renaming the active case moves the active pointer with it.
 */
export function renameCase(
  cases: SavedCase[],
  activeCaseName: string | null,
  oldName: string,
  newName: string,
): RenameResult {
  const trimmed = newName.trim()
  if (!trimmed) return { ok: false, error: 'Name cannot be empty' }
  const idx = cases.findIndex((c) => c.name === oldName)
  if (idx === -1) return { ok: false, error: `Case "${oldName}" not found` }
  if (trimmed === oldName) return { ok: true, cases, activeCaseName }
  if (cases.some((c) => c.name === trimmed)) return { ok: false, error: `A case named "${trimmed}" already exists` }
  const next = [...cases]
  next[idx] = { ...cases[idx], name: trimmed }
  return { ok: true, cases: next, activeCaseName: activeCaseName === oldName ? trimmed : activeCaseName }
}
