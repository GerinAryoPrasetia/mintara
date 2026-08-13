import type { FileMatch } from '@mintara/shared'

/** Pairs original/modified matches that share a relative path; the rest are single-sided. */
export function groupMatchesByPath(
  originalMatches: FileMatch[],
  modifiedMatches: FileMatch[],
): { paired: { path: string; original: FileMatch; modified: FileMatch }[]; originalOnly: FileMatch[]; modifiedOnly: FileMatch[] } {
  const modByPath = new Map(modifiedMatches.map((m) => [m.relativePath, m]))
  const paired: { path: string; original: FileMatch; modified: FileMatch }[] = []
  const originalOnly: FileMatch[] = []
  const pairedPaths = new Set<string>()

  for (const original of originalMatches) {
    const modified = modByPath.get(original.relativePath)
    if (modified) {
      paired.push({ path: original.relativePath, original, modified })
      pairedPaths.add(original.relativePath)
    } else {
      originalOnly.push(original)
    }
  }
  const modifiedOnly = modifiedMatches.filter((m) => !pairedPaths.has(m.relativePath))

  return { paired, originalOnly, modifiedOnly }
}
