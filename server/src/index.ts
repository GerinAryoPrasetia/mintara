import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../.env') })

import express from 'express'
import cors from 'cors'
import { compareRouter } from './routes/compare.js'
import { summarizeRouter } from './routes/summarize.js'
import { filesRouter } from './routes/files.js'

export const app = express()

app.use(cors())
app.use(express.json())

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`)
  next()
})

app.use('/api', compareRouter)
app.use('/api', summarizeRouter)
app.use('/api', filesRouter)

const PORT = process.env.PORT ?? '3001'

// Only start listening when run directly (not during tests)
if (process.env.NODE_ENV !== 'test') {
  app.listen(Number(PORT), () => {
    console.log(`mintara server running on http://localhost:${PORT}`)
  })
}
