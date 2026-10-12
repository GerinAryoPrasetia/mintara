import type { BulkRequestItem, CompareRequest } from '@mintara/shared'

/**
 * Builds the CompareRequest actually sent for one bulk item: merges the
 * shared/per-request headers on top of each target's own headers, and
 * falls back to the global normalization when the item has none of its own.
 * A target named in item.targetOverrides gets its own path and/or body.
 * The single seam every caller in this domain should go through instead of
 * re-deriving this shape by hand — see CONTEXT.md.
 */
export function buildBulkCompareRequest(
  item: BulkRequestItem,
  request: CompareRequest,
  bulkSharedHeaders: Record<string, string>,
  usePerRequestHeaders: boolean,
): CompareRequest {
  const extraHeaders = usePerRequestHeaders ? (item.headers ?? {}) : bulkSharedHeaders
  return {
    method: item.method,
    path: item.path,
    body: item.body,
    targets: request.targets.map((target) => {
      const override = item.targetOverrides?.[target.name]
      return {
        ...target,
        headers: { ...target.headers, ...extraHeaders },
        ...(override?.path !== undefined && { path: override.path }),
        ...(override && 'body' in override && { body: override.body }),
      }
    }),
    normalization: item.normalization ?? request.normalization,
  }
}
