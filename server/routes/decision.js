import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { callQwen } from '../services/llmService.js'
import { DECISION_MODEL_PROMPT } from '../prompts/decisionModel.js'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const mockPath = path.join(__dirname, '..', 'mock', 'decisionModel.json')
let mockData = null
try {
  mockData = JSON.parse(fs.readFileSync(mockPath, 'utf-8'))
} catch {
  mockData = null
}

const USE_REAL_LLM = process.env.USE_REAL_LLM === 'true'
console.log('[decision route] USE_REAL_LLM:', USE_REAL_LLM, '| API_URL:', process.env.DASHSCOPE_API_URL || '(default)')

router.post('/model', async (req, res) => {
  const { userInput } = req.body
  if (!userInput) {
    return res.status(400).json({ error: 'userInput is required' })
  }

  if (USE_REAL_LLM) {
    try {
      let result = await callQwen(DECISION_MODEL_PROMPT, userInput)
      // LLM 有时返回数组，解包为单个对象
      if (Array.isArray(result)) result = result[0]
      return res.json(result)
    } catch (err) {
      console.error('LLM call failed:', err.message)
      // Fallback to mock
    }
  }

  if (mockData) {
    let data = mockData
    if (Array.isArray(data)) data = data[0]
    return res.json(data)
  }
  res.status(500).json({ error: 'Mock data not available' })
})

router.post('/simulate', async (req, res) => {
  const { userInput } = req.body
  if (!userInput) {
    return res.status(400).json({ error: 'userInput is required' })
  }

  // Re-generate the full model from user input via LLM
  if (USE_REAL_LLM) {
    try {
      let result = await callQwen(DECISION_MODEL_PROMPT, userInput)
      if (Array.isArray(result)) result = result[0]
      return res.json(result)
    } catch (err) {
      console.error('LLM simulation failed:', err.message)
      // Fallback to mock
    }
  }

  if (mockData) {
    let data = mockData
    if (Array.isArray(data)) data = data[0]
    return res.json(data)
  }
  res.status(500).json({ error: 'Mock data not available' })
})

router.post('/deep-path', async (req, res) => {
  const { pathContext } = req.body
  if (!pathContext) {
    return res.status(400).json({ error: 'pathContext is required' })
  }

  if (mockData && mockData.paths) {
    const matched = mockData.paths.find(p => p.name === pathContext.name || p.id === pathContext.id)
    if (matched) {
      return res.json(matched)
    }
  }
  res.json({ detail: 'No deep path available', ...pathContext })
})

export default router
