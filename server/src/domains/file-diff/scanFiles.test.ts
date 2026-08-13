import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { scanRoot, matchesRequested } from './scanFiles.js'
import type { RootScanWarning } from '@mintara/shared'

describe('matchesRequested', () => {
  it('matches by basename when the request has no path segments', () => {
    expect(matchesRequested('User.php', 'app/models/User.php')).toBe(true)
    expect(matchesRequested('User.php', 'app/models/Order.php')).toBe(false)
  })

  it('matches an exact relative path, or one ending in the requested path suffix', () => {
    expect(matchesRequested('models/User.php', 'app/models/User.php')).toBe(true)
    expect(matchesRequested('models/User.php', 'app/other/models/User.php')).toBe(true)
  })

  it('does not match when the relative path does not end in the requested suffix', () => {
    expect(matchesRequested('models/User.php', 'app/models/Order.php')).toBe(false)
  })
})

describe('scanRoot', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scanfiles-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('finds a file by basename anywhere under the root', async () => {
    await fs.mkdir(path.join(tmpDir, 'app', 'models'), { recursive: true })
    await fs.writeFile(path.join(tmpDir, 'app', 'models', 'User.php'), '<?php class User {}')

    const warnings: RootScanWarning[] = []
    const hits = await scanRoot(tmpDir, ['User.php'], warnings, 'original')

    expect(hits.get('User.php')).toHaveLength(1)
    expect(hits.get('User.php')![0].relativePath).toBe('app/models/User.php')
    expect(hits.get('User.php')![0].content).toBe('<?php class User {}')
    expect(warnings).toEqual([])
  })

  it('returns an empty array for a filename with no matches', async () => {
    const warnings: RootScanWarning[] = []
    const hits = await scanRoot(tmpDir, ['Missing.php'], warnings, 'original')
    expect(hits.get('Missing.php')).toEqual([])
  })

  it('skips ignored directories like node_modules', async () => {
    await fs.mkdir(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true })
    await fs.writeFile(path.join(tmpDir, 'node_modules', 'pkg', 'target.txt'), 'ignored')
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true })
    await fs.writeFile(path.join(tmpDir, 'src', 'target.txt'), 'kept')

    const warnings: RootScanWarning[] = []
    const hits = await scanRoot(tmpDir, ['target.txt'], warnings, 'original')

    expect(hits.get('target.txt')).toHaveLength(1)
    expect(hits.get('target.txt')![0].relativePath).toBe('src/target.txt')
  })

  it('reports the real on-disk size and truncated: false for files under the byte cap', async () => {
    const content = 'x'.repeat(1000)
    await fs.writeFile(path.join(tmpDir, 'big.txt'), content)
    const warnings: RootScanWarning[] = []
    const hits = await scanRoot(tmpDir, ['big.txt'], warnings, 'original')
    expect(hits.get('big.txt')![0].sizeBytes).toBe(1000)
    expect(hits.get('big.txt')![0].truncated).toBe(false)
  })

  it('caps matches per filename', async () => {
    await fs.mkdir(path.join(tmpDir, 'many'), { recursive: true })
    for (let i = 0; i < 25; i++) {
      await fs.mkdir(path.join(tmpDir, 'many', String(i)), { recursive: true })
      await fs.writeFile(path.join(tmpDir, 'many', String(i), 'dup.txt'), String(i))
    }
    const warnings: RootScanWarning[] = []
    const hits = await scanRoot(tmpDir, ['dup.txt'], warnings, 'original')
    expect(hits.get('dup.txt')!.length).toBe(20)
  })
})
