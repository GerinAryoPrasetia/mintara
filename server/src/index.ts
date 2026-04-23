import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { compareRouter } from './routes/compare.js'

export const app = express()

app.use(cors())
app.use(express.json())
app.use('/api', compareRouter)

const PORT = process.env.PORT ?? '3001'

// Only start listening when run directly (not during tests)
if (process.env.NODE_ENV !== 'test') {
  app.listen(Number(PORT), () => {
    console.log(`mintara server running on http://localhost:${PORT}`)
  })
}
