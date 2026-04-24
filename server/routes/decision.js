import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { callQwen } from '../services/llmService.js'
import { DECISION_MODEL_PROMPT, DECISION_MODEL_DEEP_PROMPT } from '../prompts/decisionModel.js'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const mockPath = path.join(__dirname, '..', 'mock', 'decisionModel.json')
let mockData = null
try {
  mockData = JSON.parse(fs.readFileSync(mockPath, 'utf-8'))
} catch {
  mockData = null
}

// 验证并补全 LLM 返回数据，缺失必填字段时提供默认值
function sanitizeModel(raw) {
  if (!raw || typeof raw !== 'object') return null
  const m = {}
  m.options = Array.isArray(raw.options) ? raw.options : []
  m.variables = Array.isArray(raw.variables) ? raw.variables : []
  m.weights = raw.weights && typeof raw.weights === 'object' ? raw.weights : {}
  m.treeData = raw.treeData && typeof raw.treeData === 'object' ? raw.treeData : { name: '决策树', step: 0, value: 100, children: [] }
  m.paths = Array.isArray(raw.paths) ? raw.paths : []
  m.scores = raw.scores && typeof raw.scores === 'object' ? raw.scores : {}
  m.recommendation = raw.recommendation && typeof raw.recommendation === 'object'
    ? raw.recommendation
    : { rank: [], analysis: '' }
  // 补全 scores：确保每个 option 都有分数
  for (const opt of m.options) {
    if (m.scores[opt] === undefined) m.scores[opt] = 50
  }
  // 补全 variables：确保至少有一个
  if (!m.variables.length) {
    m.variables = [
      { name: '成本', type: 'slider', range: [0, 100] },
      { name: '风险偏好', type: 'select', options: ['保守', '均衡', '激进'] },
    ]
  }
  return m
}

const DECISION_MODEL = process.env.DECISION_MODEL || 'qwen-plus'
const SIMULATE_MODEL = process.env.SIMULATE_MODEL || 'qwen-plus'
const USE_REAL_LLM = process.env.USE_REAL_LLM === 'true'
console.log('[decision route] USE_REAL_LLM:', USE_REAL_LLM, '| DECISION_MODEL:', DECISION_MODEL, '| SIMULATE_MODEL:', SIMULATE_MODEL, '| API_URL:', process.env.DASHSCOPE_API_URL || '(default)')

router.post('/model', async (req, res) => {
  const { userInput } = req.body
  if (!userInput) {
    return res.status(400).json({ error: 'userInput is required' })
  }

  if (USE_REAL_LLM) {
    try {
      let result = await callQwen(DECISION_MODEL_PROMPT, userInput, DECISION_MODEL)
      if (Array.isArray(result)) result = result[0]
      result = sanitizeModel(result)
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
      let result = await callQwen(DECISION_MODEL_DEEP_PROMPT, userInput, SIMULATE_MODEL, 2, true)
      if (Array.isArray(result)) result = result[0]
      result = sanitizeModel(result)
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
