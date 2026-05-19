import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { callQwen } from '../services/llmService.js'
import {
  DECISION_MODEL_PROMPT,
  DECISION_MODEL_DEEP_PROMPT,
  DECISION_REFINE_PROMPT,
  DECISION_VALIDATE_INPUT_PROMPT,
  DECISION_DEVIL_PROMPT,
} from '../prompts/decisionModel.js'
import { validateModel, sanitizeModel } from '../../src/shared/modelValidator.js'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const mockPath = path.join(__dirname, '..', 'mock', 'decisionModel.json')
let mockData = null
try {
  mockData = JSON.parse(fs.readFileSync(mockPath, 'utf-8'))
} catch {
  mockData = null
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
    return res.json({ valid: true })
  }

  try {
    const result = await callQwen(DECISION_VALIDATE_INPUT_PROMPT, userInput, VALIDATE_MODEL, 0, false)
    return res.json(result)
  } catch (err) {
    console.error('Validation LLM call failed:', err.message)
    return res.json({ valid: true, fallback: true, message: '验证服务不可用，已放行' })
  }
})

router.post('/model', async (req, res) => {
  const { userInput, riskPreference } = req.body
  if (!userInput) {
    return res.status(400).json({ error: 'userInput is required' })
  }

  const userPrompt = riskPreference
    ? `用户问题：${userInput}\n风险偏好：${riskPreference}`
    : userInput

  console.log('=== /model LLM 指令 ===')
  console.log('[System Prompt]:', DECISION_MODEL_PROMPT)
  console.log('[User Prompt]:', userPrompt)
  console.log('=== /model 指令结束 ===')

  if (USE_REAL_LLM) {
    try {
      let result = await callQwen(
        DECISION_MODEL_PROMPT,
        userPrompt,
        DECISION_MODEL,
        2,
        false
      )
      if (Array.isArray(result)) result = result[0]

      const validationErrors = validateModel(result)
      const hasError = validationErrors.some(e => e.severity === 'error')
      const warnings = validationErrors.filter(e => e.severity === 'warning')
      if (hasError) {
        return res.status(400).json({ errors: validationErrors })
      }

      result = sanitizeModel(result)
      if (warnings.length > 0) {
        return res.json({ ...result, warnings })
      }
      return res.json(result)
    } catch (err) {
      console.error('LLM call failed:', err.message)
      return res
        .status(500)
        .json({ error: 'LLM call failed', detail: err.message })
    }
  }

  if (mockData) {
    let data = mockData
    if (Array.isArray(data)) data = data[0]
    const validationErrors = validateModel(data)
    const hasError = validationErrors.some(e => e.severity === 'error')
    const warnings = validationErrors.filter(e => e.severity === 'warning')
    if (hasError) {
      return res.status(400).json({ errors: validationErrors })
    }
    if (warnings.length > 0) {
      return res.json({ ...data, warnings })
    }
    return res.json(data)
  }
  res.status(500).json({ error: 'Mock data not available' })
})

router.post('/simulate', async (req, res) => {
  const { userInput } = req.body
  if (!userInput) {
    return res.status(400).json({ error: 'userInput is required' })
  }

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

      const validationErrors = validateModel(result)
      const hasError = validationErrors.some(e => e.severity === 'error')
      const warnings = validationErrors.filter(e => e.severity === 'warning')
      if (hasError) {
        return res.status(400).json({ errors: validationErrors })
      }

      result = sanitizeModel(result)
      if (warnings.length > 0) {
        return res.json({ ...result, warnings })
      }
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
    const validationErrors = validateModel(data)
    const hasError = validationErrors.some(e => e.severity === 'error')
    const warnings = validationErrors.filter(e => e.severity === 'warning')
    if (hasError) {
      return res.status(400).json({ errors: validationErrors })
    }
    if (warnings.length > 0) {
      return res.json({ ...data, warnings })
    }
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

      const validationErrors = validateModel(result)
      const hasError = validationErrors.some(e => e.severity === 'error')
      const warnings = validationErrors.filter(e => e.severity === 'warning')
      if (hasError) {
        return res.status(400).json({ errors: validationErrors })
      }

      result = sanitizeModel(result)
      if (warnings.length > 0) {
        return res.json({ ...result, warnings })
      }
      return res.json(result)
    } catch (err) {
      console.error('LLM refine failed:', err.message)
      return res
        .status(500)
        .json({ error: 'LLM refine failed', detail: err.message })
    }
  }

  if (mockData) {
    let data = mockData
    if (Array.isArray(data)) data = data[0]
    const validationErrors = validateModel(data)
    const hasError = validationErrors.some(e => e.severity === 'error')
    const warnings = validationErrors.filter(e => e.severity === 'warning')
    if (hasError) {
      return res.status(400).json({ errors: validationErrors })
    }
    if (warnings.length > 0) {
      return res.json({ ...data, warnings })
    }
    return res.json(data)
  }
  res.status(500).json({ error: 'Mock data not available' })
})

router.post('/devil', async (req, res) => {
  const { currentModel, monteCarloResult } = req.body
  if (!currentModel) {
    return res.status(400).json({ error: 'currentModel is required' })
  }

  console.log('[Devil] === /devil LLM 指令 ===')
  console.log('[Devil] options:', currentModel.options, '| scores:', currentModel.scores, '| weights:', currentModel.weights)

  if (USE_REAL_LLM) {
    const variables = (currentModel.variables || []).map(v => ({
      name: v.name,
      weight: currentModel.weights?.[v.name] ?? 0,
      sim_spec_type: v.sim_spec?.type || '(未定义)',
    }))

    const optionTradeOffs = (currentModel.treeData?.children || []).map(child => ({
      name: child.name,
      base_score: currentModel.scores?.[child.name] ?? 50,
      trade_offs: child.logic_payload?.trade_offs || [],
    }))

    const userPrompt = `模型概览：
- 选项：${JSON.stringify(currentModel.options)}
- 基准分：${JSON.stringify(currentModel.scores)}
- 权重：${JSON.stringify(currentModel.weights)}
- 变量（含分布类型与权重）：${JSON.stringify(variables)}
- 选项权衡分析：${JSON.stringify(optionTradeOffs)}
${monteCarloResult ? `- 蒙特卡洛排名：${JSON.stringify(monteCarloResult.ranking)}` : ''}

请对此模型进行对抗性审查。`

    try {
      let result = await callQwen(DECISION_DEVIL_PROMPT, userPrompt, DECISION_MODEL, 1, false)
      if (Array.isArray(result)) result = result[0]
      console.log('[Devil] 审查结果：challenges:', result?.challenges?.length, 'bias_flags:', result?.bias_flags?.length)
      return res.json(result)
    } catch (err) {
      console.error('Devil LLM call failed:', err.message)
      return res.status(500).json({ error: 'Devil review failed', detail: err.message })
    }
  }

  if (mockData) {
    return res.json({
      challenges: [
        { type: 'overconfident_probability', severity: 'medium', description: 'Mock: LLM 可能对概率估计过于自信', affected_option: currentModel.options?.[0], suggestion: '考虑更保守的概率估计' }
      ],
      bias_flags: [
        { type: 'optimism_bias', severity: 'medium', evidence: 'Mock: 乐观路径概率高于悲观路径' }
      ],
      winner_vulnerability: 'Mock: 排名第一的方案过于依赖单一有利条件',
      loser_defense: 'Mock: 排名最后的方案在特定情景下可能被低估',
    })
  }
  res.status(500).json({ error: 'Mock data not available' })
})

export default router
