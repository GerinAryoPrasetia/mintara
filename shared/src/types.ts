export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type DiffStatus = 'equal' | 'added' | 'removed' | 'changed'

export interface DiffNode {
  path: string       // dot-notation: "user.address.zip", arrays: "items[2].price"
  status: DiffStatus
  valueA?: unknown
  valueB?: unknown
}

export interface NormalizationOptions {
  ignoreFields: string[]   // exact dot-notation paths to exclude before diff
  sortArrays: boolean
}

export interface CompareTarget {
  name: string
  baseUrl: string
  headers: Record<string, string>
  path?: string       // overrides CompareRequest.path for this target only
  body?: unknown      // overrides CompareRequest.body for this target only
}

export interface CompareRequest {
  method: HttpMethod
  path: string
  body?: unknown
  targets: CompareTarget[]
  normalization: NormalizationOptions
}

export interface TargetResult {
  name: string
  url: string
  status: number
  responseTimeMs: number
  body: unknown
  error?: string
}

export interface CompareResult {
  targets: TargetResult[]
  hasChanges: boolean
}

export interface BulkRequestItem {
  id: string          // random uuid for React keys
  method: HttpMethod
  path: string        // path segment to append to target base URLs (e.g. "/api/v1/users")
  body?: unknown      // only for POST/PUT
  headers?: Record<string, string>  // used when usePerRequestHeaders = true
  normalization?: NormalizationOptions  // overrides global normalization when set
  // keyed by target name; lets one target get its own path/body, e.g. a second
  // unique doc number so inserts/deletes succeed on both targets of a shared DB
  targetOverrides?: Record<string, TargetOverride>
}

export interface TargetOverride {
  path?: string
  body?: unknown
}

export interface BulkItemResult {
  item: BulkRequestItem
  result: CompareResult | null
  error: string | null
  status: 'pending' | 'running' | 'done' | 'error'
}

export interface FileFindRequest {
  originalRoot: string
  modifiedRoot: string
  filenames: string[]
}

export interface FileMatch {
  relativePath: string   // relative to the root it was found under, POSIX separators
  content: string        // capped at the server's per-file byte limit
  sizeBytes: number       // actual on-disk size, even when content was truncated
  truncated: boolean
}

export interface FileFindEntry {
  filename: string              // echoes the requested name
  originalMatches: FileMatch[]  // [] = not found under originalRoot
  modifiedMatches: FileMatch[]  // [] = not found under modifiedRoot
}

export interface RootScanWarning {
  root: 'original' | 'modified'
  message: string
}

export interface FileFindResponse {
  entries: FileFindEntry[]
  warnings: RootScanWarning[]
}

// ── Mock Webhook ────────────────────────────────────────────────────────────

export type MockMethod = HttpMethod | 'PATCH' | 'HEAD' | 'OPTIONS' | 'ANY'

export interface MockResponse {
  status: number
  headers: Record<string, string>
  body: string          // raw text; may contain {{placeholders}}
  delayMs?: number
}

export interface MockRule {
  id: string
  method: MockMethod
  path: string          // sub-path after the slug: exact ('/burn') or glob ('/voucher/*')
  response: MockResponse
}

export interface MockSlug {
  slug: string
  rules: MockRule[]     // first match wins
  defaultResponse: MockResponse
  createdAt: string
  updatedAt: string
}

export type MockMatchKind = 'rule' | 'default' | 'unknown-slug'

export interface RecordedRequest {
  id: string
  slug: string
  timestamp: string
  method: string
  path: string          // full original path incl. query, e.g. /hook/voucher/burn?x=1
  subPath: string       // part after the slug, e.g. /burn
  query: Record<string, string | string[]>
  headers: Record<string, string | string[]>
  rawBody: string
  jsonBody: unknown | null
  ip: string
  response: MockResponse & { matched: MockMatchKind; ruleId?: string }
}

/** One mock as it travels in an export file — no server timestamps. */
export interface ExportedMock {
  slug: string
  rules: MockRule[]
  defaultResponse: MockResponse
}

export interface MocksExport {
  kind: 'mintara-mocks'
  version: 1
  exportedAt: string
  mocks: ExportedMock[]
}

export interface MockImportRequest {
  mocks: ExportedMock[]
  // keyed by slug; only consulted for slugs that already exist (default: skip)
  resolutions: Record<string, 'overwrite' | 'skip'>
}

export interface MockImportResult {
  created: string[]
  overwritten: string[]
  skipped: string[]
  errors: { slug: string; error: string }[]
}
