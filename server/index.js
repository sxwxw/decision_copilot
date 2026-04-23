import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import decisionRouter from './routes/decision.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.use('/api/decision', decisionRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Express server running on :${PORT}`)
})
