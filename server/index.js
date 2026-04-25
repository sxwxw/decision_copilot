import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import decisionRouter from './routes/decision.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/decision', decisionRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Only start the server when run directly (not when imported as a module)
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => {
    console.log(`Express server running on :${PORT}`)
  })
}

export default app
