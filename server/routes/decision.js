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
  DECISION_DEVIL_FRAMEWORK_PROMPT,
  DECISION_DEVIL_MODEL_PROMPT,
  DECISION_DEVIL_SIMULATE_PROMPT,
  DECISION_DEVIL_NEXUS_PROMPT,
  DECISION_FRAMEWORK_PROMPT,
  DECISION_NEXUS_PROMPT
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

// 校验 LLM 返回的决策模型数据，返回 error/warning 级别的错误列表
function validateModel(raw) {
  const errors = []

  // 非对象输入
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push({ field: '*', message: '模型数据格式错误', severity: 'error' })
    return errors
  }

  const options = Array.isArray(raw.options) ? raw.options : []
  const weights = raw.weights && typeof raw.weights === 'object' ? raw.weights : {}
  const scores = raw.scores && typeof raw.scores === 'object' ? raw.scores : {}
  const paths = Array.isArray(raw.paths) ? raw.paths : []
  const variables = Array.isArray(raw.variables) ? raw.variables.map(v => v.name) : []

  // 结构完整性：options 至少 2 个
  if (options.length < 2) {
    errors.push({ field: 'options', message: '至少需要 2 个选项', severity: 'error' })
  }

  // 范围校验：weights ∈ [0, 1]
  for (const [key, val] of Object.entries(weights)) {
    if (typeof val !== 'number' || val < 0 || val > 1) {
      errors.push({ field: `weights.${key}`, message: `权重 ${key} 超出 [0, 1] 范围 (${val})`, severity: 'error' })
    }
  }

  // 范围校验：scores ∈ [0, 100]
  for (const [key, val] of Object.entries(scores)) {
    if (typeof val !== 'number' || val < 0 || val > 100) {
      errors.push({ field: `scores.${key}`, message: `分数 ${key} 超出 [0, 100] 范围 (${val})`, severity: 'error' })
    }
  }

  // 范围校验：path probability ∈ [0, 1]
  for (let i = 0; i < paths.length; i++) {
    const prob = paths[i].probability
    if (typeof prob === 'number' && (prob < 0 || prob > 1)) {
      errors.push({ field: `paths[${i}].probability`, message: '概率超出 [0, 1] 范围', severity: 'error' })
    }
  }

  // 语义一致性：每个 option 下的路径概率之和 ≈ 1.0
  const pathsByOption = {}
  for (const p of paths) {
    if (typeof p.probability !== 'number') continue
    const optionName = (p.name || '').split('→')[0].trim()
    if (!optionName) continue
    if (!pathsByOption[optionName]) pathsByOption[optionName] = []
    pathsByOption[optionName].push(p.probability)
  }
  for (const [option, probs] of Object.entries(pathsByOption)) {
    const sum = probs.reduce((a, b) => a + b, 0)
    if (Math.abs(sum - 1.0) > 0.05) {
      errors.push({ field: 'paths', message: `「${option}」路径概率总和为 ${sum.toFixed(2)}，应 ≈ 1.0`, severity: 'warning' })
    }
  }

  // 语义一致性：weights sum ≈ 1.0
  const weightVals = Object.values(weights).filter(v => typeof v === 'number')
  if (weightVals.length > 0) {
    const wSum = weightVals.reduce((a, b) => a + b, 0)
    if (Math.abs(wSum - 1.0) > 0.05) {
      errors.push({ field: 'weights', message: `权重总和为 ${wSum.toFixed(2)}，应 ≈ 1.0`, severity: 'warning' })
    }
  }

  // 语义一致性：trade_offs.dimension ∈ variables（递归遍历 treeData）
  function checkTradeOffs(node, path) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node.logic_payload?.trade_offs)) {
      for (let i = 0; i < node.logic_payload.trade_offs.length; i++) {
        const dim = node.logic_payload.trade_offs[i].dimension
        if (dim && variables.length > 0 && !variables.includes(dim)) {
          errors.push({ field: `${path}.logic_payload.trade_offs[${i}].dimension`, message: `维度 "${dim}" 不在变量列表中`, severity: 'warning' })
        }
      }
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child, idx) => checkTradeOffs(child, `${path}.children[${idx}]`))
    }
  }
  if (raw.treeData && typeof raw.treeData === 'object') {
    checkTradeOffs(raw.treeData, 'treeData')
  }

  // 语义一致性：timeline impact key ∈ variables
  for (let i = 0; i < paths.length; i++) {
    if (Array.isArray(paths[i].timeline)) {
      for (let j = 0; j < paths[i].timeline.length; j++) {
        const impact = paths[i].timeline[j].impact
        if (impact && typeof impact === 'object' && variables.length > 0) {
          for (const key of Object.keys(impact)) {
            if (!variables.includes(key)) {
              errors.push({ field: `paths[${i}].timeline[${j}].impact.${key}`, message: `维度 "${key}" 不在变量列表中`, severity: 'warning' })
            }
          }
        }
      }
    }
  }

  // delta 范围校验：单个 delta 绝对值 > 40 为 error，> 20 为 warning
  const deltaMap = {} // { dimension: [delta, ...] }
  function collectDeltas(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node.logic_payload?.trade_offs)) {
      for (const t of node.logic_payload.trade_offs) {
        if (t.dimension && typeof t.delta === 'number') {
          if (!deltaMap[t.dimension]) deltaMap[t.dimension] = []
          deltaMap[t.dimension].push({ delta: t.delta, optionName: node.name })
          const abs = Math.abs(t.delta)
          if (abs > 40) {
            errors.push({ field: `treeData.trade_offs`, message: `"${t.dimension}" delta=${t.delta} 绝对值 > 40，超出合理范围`, severity: 'error' })
          } else if (abs > 20) {
            errors.push({ field: `treeData.trade_offs`, message: `"${t.dimension}" delta=${t.delta} 绝对值 > 20，建议控制在范围内`, severity: 'warning' })
          }
        }
      }
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(child => collectDeltas(child))
    }
  }
  if (raw.treeData && typeof raw.treeData === 'object') {
    collectDeltas(raw.treeData)
  }

  // delta 跨选项差值校验：同一维度差值 > 30 为 warning
  for (const [dim, entries] of Object.entries(deltaMap)) {
    const deltas = entries.map(e => e.delta)
    const max = Math.max(...deltas)
    const min = Math.min(...deltas)
    if (max - min > 30) {
      const involved = entries.map(e => `${e.optionName || '匿名'}(${e.delta})`).join(', ')
      errors.push({ field: 'treeData.trade_offs', message: `"${dim}" 跨选项 delta 差值 ${max - min} > 30 (${involved})，可能存在锚定偏见`, severity: 'warning' })
    }
  }

  return errors
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
  // 补全 risk_adjustment：确保每个 Option 节点都有 risk_adjustment 字段
  function ensureRiskAdjustment(node) {
    if (!node || typeof node !== 'object') return
    if (node.step === 0 && node.name && m.options.includes(node.name) && !node.logic_payload?.risk_adjustment) {
      node.logic_payload = node.logic_payload || {}
      node.logic_payload.risk_adjustment = {
        保守: { offset: 0 },
        均衡: { offset: 0 },
        激进: { offset: 0 },
      }
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(child => ensureRiskAdjustment(child))
    }
  }
  if (m.treeData && typeof m.treeData === 'object') {
    ensureRiskAdjustment(m.treeData)
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
    const result = await callQwen(DECISION_VALIDATE_INPUT_PROMPT, userInput, VALIDATE_MODEL, 0, false)
    return res.json(result)
  } catch (err) {
    console.error('Validation LLM call failed:', err.message)
    // Fail with warning: let request proceed but flag that validation was unavailable
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

      // 校验
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
      // Return error info for debugging
      return res
        .status(500)
        .json({ error: 'LLM call failed', detail: err.message })
    }
  }

  if (mockData) {
    let data = mockData
    if (Array.isArray(data)) data = data[0]
    // 对 mock 数据也执行校验
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

      // 校验
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
    // 对 mock 数据也执行校验
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

      // 校验
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

  // Fallback: return current model unchanged with delta_analysis
  if (mockData) {
    let data = mockData
    if (Array.isArray(data)) data = data[0]
    // 对 mock 数据也执行校验
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
    // Build complete variable info for DEVIL review
    const variables = (currentModel.variables || []).map(v => ({
      name: v.name,
      weight: currentModel.weights?.[v.name] ?? 0,
      sim_spec_type: v.sim_spec?.type || '(未定义)',
    }))

    // Extract trade_offs per option from treeData.children
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

  // Mock mode: return placeholder
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

// ── Multi-agent pipeline routes ──

/** In-memory pipeline state for breakpoint resume */
const pipelineState = {}

// POST /framework: FRAMEWORK agent step
router.post('/framework', async (req, res) => {
  const { userInput, pipelineId } = req.body
  if (!userInput) {
    return res.status(400).json({ error: 'userInput is required' })
  }

  const id = pipelineId || `pipeline-${Date.now()}`
  console.log('[Pipeline] FRAMEWORK step started for:', id)

  if (USE_REAL_LLM) {
    try {
      let result = await callQwen(DECISION_FRAMEWORK_PROMPT, userInput, DECISION_MODEL, 1, false)
      if (Array.isArray(result)) result = result[0]
      console.log('[Pipeline] FRAMEWORK step done, options:', result?.options)

      pipelineState[id] = { id, steps: { framework: result }, lastStep: 'framework', status: 'running' }
      return res.json({ pipelineId: id, step: 'framework', result })
    } catch (err) {
      console.error('[Pipeline] FRAMEWORK failed:', err.message)
      return res.status(500).json({ error: 'Framework step failed', detail: err.message })
    }
  }

  if (mockData) {
    const mockFramework = {
      decision_context: 'Mock framework',
      options: mockData.options,
      dimensions: mockData.variables?.map(v => ({ name: v.name, description: '', sim_spec_hint: 'normal' })) || [],
      key_tradeoffs: [],
      risk_factors: [],
    }
    pipelineState[id] = { id, steps: { framework: mockFramework }, lastStep: 'framework', status: 'running' }
    return res.json({ pipelineId: id, step: 'framework', result: mockFramework })
  }
  res.status(500).json({ error: 'Mock data not available' })
})

// POST /build-model: MODEL-BUILD agent step (uses framework output)
router.post('/build-model', async (req, res) => {
  const { userInput, frameworkResult, pipelineId } = req.body
  if (!userInput) {
    return res.status(400).json({ error: 'userInput is required' })
  }

  const id = pipelineId || `pipeline-${Date.now()}`
  console.log('[Pipeline] MODEL-BUILD step started for:', id)

  if (USE_REAL_LLM) {
    try {
      const userPrompt = `用户问题：${userInput}
框架定义：${JSON.stringify(frameworkResult)}`

      let result = await callQwen(DECISION_MODEL_DEEP_PROMPT, userPrompt, DECISION_MODEL, 2, false)
      if (Array.isArray(result)) result = result[0]
      console.log('[Pipeline] MODEL-BUILD step done, options:', result?.options?.length)

      // Update pipeline state
      if (!pipelineState[id]) pipelineState[id] = { id, steps: {}, lastStep: null, status: 'running' }
      pipelineState[id].steps['build-model'] = result
      pipelineState[id].lastStep = 'build-model'
      return res.json({ pipelineId: id, step: 'build-model', result })
    } catch (err) {
      console.error('[Pipeline] MODEL-BUILD failed:', err.message)
      return res.status(500).json({ error: 'Build-model step failed', detail: err.message })
    }
  }

  if (mockData) {
    let data = mockData
    if (Array.isArray(data)) data = data[0]
    if (!pipelineState[id]) pipelineState[id] = { id, steps: {}, lastStep: null, status: 'running' }
    pipelineState[id].steps['build-model'] = data
    pipelineState[id].lastStep = 'build-model'
    return res.json({ pipelineId: id, step: 'build-model', result: data })
  }
  res.status(500).json({ error: 'Mock data not available' })
})

// ── Shared pipeline step definitions ──
// 9-step adversarial pipeline: each main step followed by a DEVIL sub-step

const PIPELINE_STEPS = [
  { name: 'framework', prompt: DECISION_FRAMEWORK_PROMPT, model: DECISION_MODEL, retries: 1 },
  { name: 'devil-framework', prompt: DECISION_DEVIL_FRAMEWORK_PROMPT, model: DECISION_MODEL, retries: 1 },
  { name: 'build-model', prompt: DECISION_MODEL_DEEP_PROMPT, model: DECISION_MODEL, retries: 2 },
  { name: 'devil-model', prompt: DECISION_DEVIL_MODEL_PROMPT, model: DECISION_MODEL, retries: 1 },
  { name: 'simulate', prompt: null, model: null, retries: 0 },
  { name: 'devil-simulate', prompt: DECISION_DEVIL_SIMULATE_PROMPT, model: DECISION_MODEL, retries: 1 },
  { name: 'devil-nexus', prompt: DECISION_DEVIL_NEXUS_PROMPT, model: DECISION_MODEL, retries: 1 },
  { name: 'nexus', prompt: DECISION_NEXUS_PROMPT, model: DECISION_MODEL, retries: 1 },
]

/**
 * Execute pipeline steps from startIndex.
 * If currentModel is provided, inject it as context constraint for each step.
 */
async function executePipelineSteps(pipelineId, fromStepIdx, userInput, sendEvent, currentModel) {
  for (let i = fromStepIdx; i < PIPELINE_STEPS.length; i++) {
    const step = PIPELINE_STEPS[i]
    sendEvent('step', { step: step.name, status: 'running' })
    console.log(`[Pipeline] Step "${step.name}" started`)

    // simulate step: placeholder, skip LLM call
    if (step.name === 'simulate') {
      console.log('[Pipeline] Step "simulate" skipped (frontend triggers real simulation)')
      sendEvent('step', { step: 'simulate', status: 'completed' })
      continue
    }

    let userPrompt = userInput
    const steps = pipelineState[pipelineId].steps

    if (step.name === 'devil-framework') {
      userPrompt = `请审查以下决策框架：
${JSON.stringify(steps.framework || {})}`
    } else if (step.name === 'devil-model') {
      const model = steps['build-model'] || {}
      const variables = (model.variables || []).map(v => ({
        name: v.name,
        weight: model.weights?.[v.name] ?? 0,
        sim_spec_type: v.sim_spec?.type || '(未定义)',
      }))
      userPrompt = `模型概览：
- 选项：${JSON.stringify(model.options)}
- 基准分：${JSON.stringify(model.scores)}
- 权重：${JSON.stringify(model.weights)}
- 变量（含分布类型与权重）：${JSON.stringify(variables)}
- 选项权衡分析：${JSON.stringify((model.treeData?.children || []).map(child => ({ name: child.name, base_score: model.scores?.[child.name] ?? 50, trade_offs: child.logic_payload?.trade_offs || [] })))}
- 框架定义：${JSON.stringify(steps.framework || {})}`
    } else if (step.name === 'devil-simulate') {
      const model = steps['build-model'] || {}
      userPrompt = `仿真模型概览：
- 变量与分布：${JSON.stringify((model.variables || []).map(v => ({ name: v.name, sim_spec: v.sim_spec })))}
- 权重：${JSON.stringify(model.weights)}
${steps['devil-framework'] ? `\n- 框架审查意见：${JSON.stringify(steps['devil-framework'])}` : ''}
${steps['devil-model'] ? `\n- 模型审查意见：${JSON.stringify(steps['devil-model'])}` : ''}`
    } else if (step.name === 'devil-nexus') {
      userPrompt = `最终决策结论：${JSON.stringify(steps.nexus || {})}
所有审查意见汇总：
- 框架审查：${JSON.stringify(steps['devil-framework'] || {})}
- 模型审查：${JSON.stringify(steps['devil-model'] || {})}
- 仿真审查：${JSON.stringify(steps['devil-simulate'] || {})}`
    } else if (step.name === 'framework') {
      if (currentModel) {
        userPrompt = `用户问题：${userInput}
已有决策模型供参考（请在其基础上细化维度，不要从零开始）：
- 选项：${JSON.stringify(currentModel.options)}
- 变量：${JSON.stringify(currentModel.variables?.map(v => ({ name: v.name, type: v.type })))}
- 权重：${JSON.stringify(currentModel.weights)}`
      }
    } else if (step.name === 'build-model') {
      if (currentModel) {
        userPrompt = `用户问题：${userInput}
框架定义：${JSON.stringify(steps.framework || {})}

### 严格约束（深度验证模式）
- **options 列表必须与以下完全一致**：${JSON.stringify(currentModel.options)}
- **weights 权重必须与以下完全一致**：${JSON.stringify(currentModel.weights)}
- 请在已有模型基础上补充 trade_offs、扩展 treeData 路径、完善 sim_spec
- 不得修改选项名称和权重分配`
      } else {
        userPrompt = `用户问题：${userInput}\n框架定义：${JSON.stringify(steps.framework || {})}`
      }
    } else if (step.name === 'nexus') {
      const model = steps['build-model'] || {}
      // Compute confidence signals
      const scoreVals = Object.values(model.scores || {}).filter(v => typeof v === 'number')
      const sorted = scoreVals.sort((a, b) => b - a)
      const scoreGap = sorted.length >= 2 ? sorted[0] - sorted[1] : 0
      const pathProbs = (model.paths || []).filter(p => typeof p.probability === 'number').map(p => p.probability)
      const probSum = pathProbs.length > 0 ? pathProbs.reduce((a, b) => a + b, 0) : 0
      const devilCounts = { high: 0, medium: 0, low: 0 }
      for (const ds of ['devil-framework', 'devil-model', 'devil-simulate', 'devil-nexus']) {
        const d = steps[ds]
        if (!d) continue
        const items = d.questions || d.issues || d.questionable_assumptions || d.dependencies || []
        for (const item of items) {
          if (devilCounts[item.severity] !== undefined) devilCounts[item.severity]++
        }
      }
      const confidenceSignals = `
### 置信度判断信号（供 LLM 综合评估 0-100）
- 第一名与第二名分差：${scoreGap.toFixed(1)}
- 审查问题统计：high=${devilCounts.high}, medium=${devilCounts.medium}, low=${devilCounts.low}
- 路径概率总和：${probSum.toFixed(2)}
`

      if (currentModel) {
        userPrompt = `综合所有分析结果，生成最终决策报告。
框架：${JSON.stringify(steps.framework || {})}
模型：${JSON.stringify(model)}
审查：${JSON.stringify(steps['devil-model'] || {})}
${confidenceSignals}
### 严格约束（深度验证模式）
- 请融合流水线结果与已有模型，确保 options 和 weights 结构一致性
- 已有模型参考：${JSON.stringify({ options: currentModel.options, weights: currentModel.weights, scores: currentModel.scores })}`
      } else {
        userPrompt = `综合所有分析结果，生成最终决策报告。
框架：${JSON.stringify(steps.framework || {})}
模型：${JSON.stringify(model)}
全部审查意见：
- 框架审查：${JSON.stringify(steps['devil-framework'] || {})}
- 模型审查：${JSON.stringify(steps['devil-model'] || {})}
- 仿真审查：${JSON.stringify(steps['devil-simulate'] || {})}
- 结论审查：${JSON.stringify(steps['devil-nexus'] || {})}
${confidenceSignals}`
      }
    }

    if (USE_REAL_LLM) {
      let result = await callQwen(step.prompt, userPrompt, step.model, step.retries, false)
      if (Array.isArray(result)) result = result[0]
      pipelineState[pipelineId].steps[step.name] = result
      pipelineState[pipelineId].lastStep = step.name
    } else if (mockData) {
      let data = mockData
      if (Array.isArray(data)) data = data[0]
      // DEVIL steps expect different JSON structures than the main model
      if (step.name === 'devil-framework') {
        pipelineState[pipelineId].steps[step.name] = {
          stage: 'devil-framework',
          questions: [
            { type: 'option_exhaustion', severity: 'medium', description: 'Mock: 可能存在未被穷举的中间方案' }
          ],
          missing_options: ['Mock: 混合方案'],
          summary: 'Mock: 框架层面选项穷举性不足',
        }
      } else if (step.name === 'devil-model') {
        pipelineState[pipelineId].steps[step.name] = {
          stage: 'devil-model',
          issues: [
            { type: 'weight_distortion', severity: 'medium', description: 'Mock: 某变量权重可能过高', affected_element: 'Mock: 成本' }
          ],
          biased_variables: [],
          summary: 'Mock: 模型层面权重分配可能存在偏差',
        }
      } else if (step.name === 'devil-simulate') {
        pipelineState[pipelineId].steps[step.name] = {
          stage: 'devil-simulate',
          questionable_assumptions: [
            { variable: 'Mock: 成本', issue: 'Mock: 分布均值假设可能过于乐观', severity: 'medium' }
          ],
          tail_risks: ['Mock: 极端低成本场景未被覆盖'],
          summary: 'Mock: 仿真层面概率假设值得怀疑',
        }
      } else if (step.name === 'devil-nexus') {
        pipelineState[pipelineId].steps[step.name] = {
          stage: 'devil-nexus',
          dependencies: [
            { premise: 'Mock: 成本预测准确', risk_if_false: '方案排名可能反转', severity: 'high' }
          ],
          sensitivity: ['Mock: 对成本变量最敏感'],
          failure_modes: ['Mock: 外部环境剧变时结论失效'],
          summary: 'Mock: 结论依赖多个不确定前提',
        }
      } else {
        pipelineState[pipelineId].steps[step.name] = data
      }
      pipelineState[pipelineId].lastStep = step.name
    }

    sendEvent('step', { step: step.name, status: 'completed' })
    console.log(`[Pipeline] Step "${step.name}" completed`)
  }
}
// POST /full-pipeline: Run all 5 steps with SSE progress
// If currentModel is provided, enters deep-validation mode (keeps options/weights unchanged)
router.post('/full-pipeline', async (req, res) => {
  const { userInput, currentModel } = req.body
  if (!userInput) {
    return res.status(400).json({ error: 'userInput is required' })
  }

  const id = `pipeline-${Date.now()}`
  const mode = currentModel ? 'deep-validation' : 'quick-build'
  console.log(`[Pipeline] Full pipeline started (${mode}):`, id)

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  try {
    pipelineState[id] = { id, steps: {}, lastStep: null, status: 'running' }

    await executePipelineSteps(id, 0, userInput, sendEvent, currentModel || null)

    pipelineState[id].status = 'completed'
    sendEvent('complete', { pipelineId: id, steps: pipelineState[id].steps, mode })
    res.end()
  } catch (err) {
    console.error('[Pipeline] Full pipeline failed:', err.message)
    sendEvent('error', { message: err.message })
    if (pipelineState[id]) pipelineState[id].status = 'failed'
    res.end()
  }
})

// GET /pipeline/:id: Query pipeline state (for breakpoint resume)
router.get('/pipeline/:id', (req, res) => {
  const { id } = req.params
  const state = pipelineState[id]
  if (!state) {
    return res.status(404).json({ error: 'Pipeline not found' })
  }
  res.json(state)
})

// POST /pipeline/:id/resume: Resume from checkpoint
router.post('/pipeline/:id/resume', async (req, res) => {
  const { id } = req.params
  const state = pipelineState[id]
  if (!state) {
    return res.status(404).json({ error: 'Pipeline not found' })
  }

  // Check if pipeline steps data is empty (server restarted)
  if (!state.lastStep && Object.keys(state.steps || {}).length === 0) {
    return res.status(404).json({ error: 'Pipeline data lost, cannot resume' })
  }

  console.log(`[Pipeline] Resuming pipeline ${id} from step: ${state.lastStep}`)

  const stepNames = PIPELINE_STEPS.map(s => s.name)
  const resumeIdx = state.lastStep ? stepNames.indexOf(state.lastStep) + 1 : 0

  if (resumeIdx >= stepNames.length) {
    return res.json({ pipelineId: id, status: 'completed', steps: state.steps })
  }

  state.status = 'running'

  // Create a mock sendEvent that returns response data instead of writing to socket
  const sentEvents = []
  const sendEvent = (event, data) => {
    sentEvents.push({ event, data })
  }

  await executePipelineSteps(id, resumeIdx, '', sendEvent)

  state.status = 'completed'
  return res.json({ pipelineId: id, status: 'completed', steps: state.steps, events: sentEvents })
})

export default router
