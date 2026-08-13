import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../.env') })

import express from 'express'
import cors from 'cors'
import { apiDiffRouter } from './domains/api-diff/routes.js'
import { summarizeRouter } from './domains/api-diff/summarizeRoutes.js'
import { fileDiffRouter } from './domains/file-diff/routes.js'

export const app = express()

app.use(cors())
app.use(express.json())

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`)
  next()
})

app.use('/api', apiDiffRouter)
app.use('/api', summarizeRouter)
app.use('/api', fileDiffRouter)

const PORT = process.env.PORT ?? '3001'

// Only start listening when run directly (not during tests)
if (process.env.NODE_ENV !== 'test') {
  app.listen(Number(PORT), () => {
    console.log(`mintara server running on http://localhost:${PORT}`)
  })
}
