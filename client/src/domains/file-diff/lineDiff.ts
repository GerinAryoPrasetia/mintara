export interface DiffLine {
  lineNumber: string
  content: string
  type: 'added' | 'removed' | 'unchanged' | 'modified'
}

/**
 * LCS-based line diff, split into left (original) and right (modified)
 * columns — removed lines leave a blank slot on the right and vice versa.
 */
export function computeLineByLineDiff(oldText: string, newText: string): { left: DiffLine[]; right: DiffLine[]; hasDiff: boolean } {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const left: DiffLine[] = []
  const right: DiffLine[] = []
  let hasDiff = false

  // Simple LCS-based diff algorithm
  const m = oldLines.length
  const n = newLines.length

  // Build LCS matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to find diff
  let i = m, j = n
  const ops: { op: 'equal' | 'delete' | 'insert', oldIdx?: number, newIdx?: number }[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ op: 'equal', oldIdx: i - 1, newIdx: j - 1 })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ op: 'insert', newIdx: j - 1 })
      j--
    } else {
      ops.unshift({ op: 'delete', oldIdx: i - 1 })
      i--
    }
  }

  let leftLineNum = 1
  let rightLineNum = 1

  for (const op of ops) {
    if (op.op === 'equal') {
      left.push({ lineNumber: String(leftLineNum++), content: oldLines[op.oldIdx!], type: 'unchanged' })
      right.push({ lineNumber: String(rightLineNum++), content: newLines[op.newIdx!], type: 'unchanged' })
    } else if (op.op === 'delete') {
      left.push({ lineNumber: String(leftLineNum++), content: oldLines[op.oldIdx!], type: 'removed' })
      right.push({ lineNumber: '', content: '', type: 'removed' })
      hasDiff = true
    } else if (op.op === 'insert') {
      left.push({ lineNumber: '', content: '', type: 'added' })
      right.push({ lineNumber: String(rightLineNum++), content: newLines[op.newIdx!], type: 'added' })
      hasDiff = true
    }
  }

  return { left, right, hasDiff }
}

/** Same diff, collapsed into a single unified column. */
export function computeUnifiedDiff(oldText: string, newText: string): { lines: DiffLine[]; hasDiff: boolean } {
  const { left, right } = computeLineByLineDiff(oldText, newText)
  const lines: DiffLine[] = []
  let hasDiff = false

  const maxLen = Math.max(left.length, right.length)
  for (let i = 0; i < maxLen; i++) {
    const l = left[i]
    const r = right[i]

    if (l && r && l.type === 'unchanged' && r.type === 'unchanged') {
      lines.push(l)
    } else {
      hasDiff = true
      if (l && l.type !== 'added') {
        lines.push(l)
      }
      if (r && r.type !== 'removed') {
        lines.push(r)
      }
    }
  }

  return { lines, hasDiff }
}
