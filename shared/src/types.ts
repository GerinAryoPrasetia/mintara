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

export interface CompareRequest {
  method: HttpMethod
  path: string
  body?: unknown
  targets: Array<{ name: string; baseUrl: string; headers: Record<string, string> }>
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
