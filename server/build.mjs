// Builds the publishable mintara CLI package:
//   1. builds the client SPA and copies its output into server/public/
//   2. copies the repo root README into server/README.md — npm only
//      auto-includes a README that lives in the *published* package's
//      root (server/), not the repo root, regardless of the "files" field
//   3. bundles the server (including the @mintara/shared workspace
//      package, which is TypeScript-source-only) into a single dist/index.js
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { cpSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const clientDist = resolve(repoRoot, 'client/dist')
const publicDir = resolve(__dirname, 'public')

console.log('[1/3] Building client...')
execFileSync('npm', ['run', 'build', '--workspace=client'], { cwd: repoRoot, stdio: 'inherit' })
if (!existsSync(clientDist)) {
  throw new Error(`Client build did not produce ${clientDist}`)
}
rmSync(publicDir, { recursive: true, force: true })
cpSync(clientDist, publicDir, { recursive: true })

console.log('[2/3] Copying README...')
cpSync(resolve(repoRoot, 'README.md'), resolve(__dirname, 'README.md'))

console.log('[3/3] Bundling server...')
await build({
  entryPoints: [resolve(__dirname, 'src/index.ts')],
  outfile: resolve(__dirname, 'dist/index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  // Real npm dependencies stay external (resolved from the published
  // package's own node_modules); @mintara/shared has no entry here so
  // esbuild inlines its TypeScript source directly into the bundle.
  external: ['express', 'cors', 'dotenv', 'axios', 'ollama'],
})

console.log('Build complete.')
