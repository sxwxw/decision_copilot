import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import { rateLimit } from 'express-rate-limit'
import { checkLlmAvailability } from './services/llmService.js'
import decisionRouter from './routes/decision.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'))

const app = express()

app.use(cors())
app.use(express.json())

// Rate limit for /api/decision/* routes
const decisionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' }
})
app.use('/api/decision', decisionLimiter)

const startTime = Date.now()

app.get('/api/health', async (_req, res) => {
  const llmAvailable = await checkLlmAvailability()
  const uptime = Math.round((Date.now() - startTime) / 1000)
  res.json({
    status: llmAvailable ? 'ok' : 'degraded',
    llm: llmAvailable ? 'available' : 'unavailable',
    uptime,
    version: pkg.version,
  })
})

app.use('/api/decision', decisionRouter)

// Only start the server when run directly (not when imported as a module)
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => {
    console.log(`Express server running on :${PORT}`)
  })
}

export default app
