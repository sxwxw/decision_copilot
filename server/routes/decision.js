import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { callQwen } from '../services/llmService.js'
import {
  DECISION_MODEL_PROMPT,
  DECISION_MODEL_DEEP_PROMPT,
  DECISION_REFINE_PROMPT,
  DECISION_VALIDATE_PROMPT
} from '../prompts/decisionModel.js'

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
  m.treeData =
    raw.treeData && typeof raw.treeData === 'object'
      ? raw.treeData
      : { name: '决策树', step: 0, value: 100, children: [] }
  m.paths = Array.isArray(raw.paths) ? raw.paths : []
  m.scores = raw.scores && typeof raw.scores === 'object' ? raw.scores : {}
  m.recommendation =
    raw.recommendation && typeof raw.recommendation === 'object'
      ? raw.recommendation
      : { analysis: '' }
  // 补全 scores：确保每个 option 都有分数
  for (const opt of m.options) {
    if (m.scores[opt] === undefined) m.scores[opt] = 50
  }
  // 补全 variables：确保至少有一个
  if (!m.variables.length) {
    m.variables = [
      { name: '成本', type: 'slider', range: [0, 100] },
      { name: '风险偏好', type: 'select', options: ['保守', '均衡', '激进'] }
    ]
  }
  return m
}

const DECISION_MODEL = process.env.DECISION_MODEL || 'qwen-plus'
const SIMULATE_MODEL = process.env.SIMULATE_MODEL || 'qwen-plus'
const VALIDATE_MODEL = process.env.DECISION_MODEL || 'qwen3.5-flash'
const USE_REAL_LLM = process.env.USE_REAL_LLM === 'true'
console.log(
  '[decision route] USE_REAL_LLM:',
  USE_REAL_LLM,
  '| DECISION_MODEL:',
  DECISION_MODEL,
  '| SIMULATE_MODEL:',
  SIMULATE_MODEL,
  '| VALIDATE_MODEL:',
  VALIDATE_MODEL,
  '| API_URL:',
  process.env.DASHSCOPE_API_URL || '(default)'
)

router.post('/validate', async (req, res) => {
  const { userInput } = req.body
  if (!userInput) {
    return res.status(400).json({ error: 'userInput is required' })
  }

  if (!USE_REAL_LLM) {
    // Mock mode: always pass validation
    return res.json({ valid: true })
  }

  try {
    const result = await callQwen(DECISION_VALIDATE_PROMPT, userInput, VALIDATE_MODEL, 0, false)
    return res.json(result)
  } catch (err) {
    console.error('Validation LLM call failed:', err.message)
    // Fail open: if validation service is down, let the main call proceed
    return res.json({ valid: true })
  }
})

router.post('/model', async (req, res) => {
  const { userInput } = req.body
  if (!userInput) {
    return res.status(400).json({ error: 'userInput is required' })
  }

  console.log('=== /model LLM 指令 ===')
  console.log('[System Prompt]:', DECISION_MODEL_PROMPT)
  console.log('[User Prompt]:', userInput)
  console.log('=== /model 指令结束 ===')

  if (USE_REAL_LLM) {
    try {
      let result = await callQwen(
        DECISION_MODEL_PROMPT,
        userInput,
        DECISION_MODEL,
        2,
        false
      )
      if (Array.isArray(result)) result = result[0]
      result = sanitizeModel(result)
      return res.json(result)
    } catch (err) {
      console.error('LLM call failed:', err.message)
      // Return error info for debugging
      return res
        .status(500)
        .json({ error: 'LLM call failed', detail: err.message })
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
  console.log('=== /simulate LLM 指令 ===')
  console.log('[System Prompt]:', DECISION_MODEL_DEEP_PROMPT)
  console.log('[User Prompt]:', userInput)
  console.log('=== /simulate 指令结束 ===')

  if (USE_REAL_LLM) {
    try {
      let result = await callQwen(
        DECISION_MODEL_DEEP_PROMPT,
        userInput,
        SIMULATE_MODEL,
        2,
        false
      )
      if (Array.isArray(result)) result = result[0]
      result = sanitizeModel(result)
      return res.json(result)
    } catch (err) {
      console.error('LLM simulation failed:', err.message)
      return res
        .status(500)
        .json({ error: 'LLM simulation failed', detail: err.message })
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
    const matched = mockData.paths.find(
      p => p.name === pathContext.name || p.id === pathContext.id
    )
    if (matched) {
      return res.json(matched)
    }
  }
  res.json({ detail: 'No deep path available', ...pathContext })
})

router.post('/refine', async (req, res) => {
  const { currentModel, paramValues, userInput } = req.body
  if (!currentModel || !paramValues) {
    return res
      .status(400)
      .json({ error: 'currentModel and paramValues are required' })
  }

  const userPrompt = `用户原始问题：${userInput || ''}
当前参数值：${JSON.stringify(paramValues)}
结构约束：
- 选项列表：${JSON.stringify(currentModel.options)}
- 权重分配：${JSON.stringify(currentModel.weights)}`

  console.log('=== /refine LLM 指令 ===')
  console.log('[System Prompt]:', DECISION_REFINE_PROMPT)
  console.log('[User Prompt]:', userPrompt)
  console.log('=== /refine 指令结束 ===')

  if (USE_REAL_LLM) {
    try {
      let result = await callQwen(
        DECISION_REFINE_PROMPT,
        userPrompt,
        SIMULATE_MODEL,
        2,
        false
      )
      if (Array.isArray(result)) result = result[0]
      result = sanitizeModel(result)
      return res.json(result)
    } catch (err) {
      console.error('LLM refine failed:', err.message)
      return res
        .status(500)
        .json({ error: 'LLM refine failed', detail: err.message })
    }
  }

  // Fallback: return current model unchanged with delta_analysis
  if (mockData) {
    let data = mockData
    if (Array.isArray(data)) data = data[0]
    return res.json(data)
  }
  res.status(500).json({ error: 'Mock data not available' })
})

export default router
