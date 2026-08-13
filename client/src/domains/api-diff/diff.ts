import type { NormalizationOptions, DiffNode } from '@mintara/shared'
import { compare, normalize } from '@mintara/shared'

/**
 * Normalizes both bodies and diffs them. The single seam every caller in
 * this domain should go through instead of pairing normalize()/compare()
 * by hand — see CONTEXT.md.
 */
export function diffTargets(
  bodyA: unknown,
  bodyB: unknown,
  normalization: NormalizationOptions,
): DiffNode[] {
  const normA = normalize(bodyA, normalization)
  const normB = normalize(bodyB, normalization)
  return compare(normA, normB, '')
}
