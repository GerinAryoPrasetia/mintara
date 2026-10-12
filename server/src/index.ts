import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve, join } from 'path'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// In the monorepo checkout, env config lives at the repo root. When
// installed as a published CLI there is no repo root — fall back to
// loading a .env from wherever the user runs `mintara` (a no-op if absent).
const monorepoEnvPath = resolve(__dirname, '../../.env')
if (existsSync(monorepoEnvPath)) {
  config({ path: monorepoEnvPath })
} else {
  config()
}

import express from 'express'
import cors from 'cors'
import { apiDiffRouter } from './domains/api-diff/routes.js'
import { summarizeRouter } from './domains/api-diff/summarizeRoutes.js'
import { fileDiffRouter } from './domains/file-diff/routes.js'
import { createMockStore } from './domains/mock-webhook/mockStore.js'
import { createRequestLog } from './domains/mock-webhook/requestLog.js'
import { createHookRouter } from './domains/mock-webhook/hookRoutes.js'
import { createMockAdminRouter } from './domains/mock-webhook/routes.js'
import { homedir } from 'os'

const PORT = process.env.PORT ?? '3001'

// Mock definitions persist to ~/.mintara/mocks.json (override the directory
// with MINTARA_DATA_DIR); tests get an in-memory store. Request logs are
// always in memory only.
const mockStore = createMockStore(
  process.env.NODE_ENV === 'test'
    ? null
    : join(process.env.MINTARA_DATA_DIR ?? join(homedir(), '.mintara'), 'mocks.json'),
)
const mockLog = createRequestLog()

export const app = express()

app.use(cors())

// Method + URL only — never bodies (the /hook log can hold tokens / customer data)
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`)
  next()
})

// Before express.json(), so the mock receiver captures the raw body itself
app.use('/hook', createHookRouter({ store: mockStore, log: mockLog }))

app.use(express.json())

app.use('/api', apiDiffRouter)
app.use('/api', summarizeRouter)
app.use('/api', fileDiffRouter)
app.use('/api', createMockAdminRouter({ store: mockStore, log: mockLog, port: Number(PORT) }))

// Serve the built client, when present (the published CLI ships one
// alongside dist/; a plain monorepo dev checkout does not, and the
// client is served separately by Vite in that case).
const publicDir = resolve(__dirname, '../public')
const hasClient = existsSync(publicDir)
if (hasClient) {
  app.use(express.static(publicDir))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/hook')) return next()
    res.sendFile(join(publicDir, 'index.html'))
  })
}

// Only start listening when run directly (not during tests)
if (process.env.NODE_ENV !== 'test') {
  app.listen(Number(PORT), () => {
    const url = `http://localhost:${PORT}`
    console.log('')
    console.log(`  mintara ready ✓`)
    console.log('')
    if (hasClient) {
      console.log(`  ➜  App:  ${url}`)
    }
    console.log(`  ➜  API:  ${url}/api`)
    console.log(`  ➜  Mock: ${url}/hook/<slug>`)
    if (!hasClient) {
      console.log(`  ➜  (dev mode — client runs separately via \`npm run dev --workspace=client\`)`)
    }
    console.log('')
  })
}
