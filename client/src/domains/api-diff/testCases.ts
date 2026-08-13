import type { CompareRequest, BulkRequestItem } from '@mintara/shared'

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

export interface SavedCasesExport {
  version: 1
  exportedAt: string
  cases: SavedCase[]
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
