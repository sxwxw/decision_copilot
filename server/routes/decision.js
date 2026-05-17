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
import { validateModel, sanitizeModel } from '../../src/shared/modelValidator.js'
import { runMonteCarlo } from '../../src/utils/simulator.js'
import { sanitizeDevilReview } from '../utils/sanitizeDevilReview.js'

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

const MAX_PIPELINE_ENTRIES = 100
const MAX_OUTER_LOOP = 5 // keep re-running until confidence >= 60, capped at 5
const PIPELINE_TTL_MS = 24 * 60 * 60 * 1000 // 24h

/**
 * LRU + TTL cleanup for pipelineState. Call after creating a new pipeline.
 */
function cleanupPipelineState() {
  const now = Date.now()
  const ids = Object.keys(pipelineState)

  // Remove expired entries
  for (const id of ids) {
    if (now - (pipelineState[id].createdAt || 0) > PIPELINE_TTL_MS) {
      delete pipelineState[id]
    }
  }

  // Keep only the most recent MAX_PIPELINE_ENTRIES entries
  const remaining = Object.keys(pipelineState)
    .sort((a, b) => (pipelineState[b].createdAt || 0) - (pipelineState[a].createdAt || 0))
  if (remaining.length > MAX_PIPELINE_ENTRIES) {
    for (const id of remaining.slice(MAX_PIPELINE_ENTRIES)) {
      delete pipelineState[id]
    }
  }
}

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

      pipelineState[id] = { id, steps: { framework: result }, lastStep: 'framework', status: 'running', userInput, createdAt: Date.now() }
      cleanupPipelineState()
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
    pipelineState[id] = { id, steps: { framework: mockFramework }, lastStep: 'framework', status: 'running', createdAt: Date.now() }
    cleanupPipelineState()
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

      // 清洗模型数据（定性标签转换、归一化等）
      result = sanitizeModel(result)

      // Update pipeline state
      if (!pipelineState[id]) pipelineState[id] = { id, steps: {}, lastStep: null, status: 'running', createdAt: Date.now() }
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
    // 对 mock 数据也执行清洗
    data = sanitizeModel(data)
    if (!pipelineState[id]) pipelineState[id] = { id, steps: {}, lastStep: null, status: 'running', createdAt: Date.now() }
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
  const state = pipelineState[pipelineId]
  const steps = state.steps
  let innerLoopCount = state.innerLoopCount || 0
  let outerLoopCount = state.outerLoopCount || 0
  let devilDirectives = null // correction directives from inner loop
  let defeatContext = null   // defeat context from outer loop

  // Build defeat context for outer loop
  const buildDefeatContext = (allSteps) => {
    const parts = []
    // Extract high/critical items from devil steps
    for (const ds of ['devil-framework', 'devil-model', 'devil-simulate', 'devil-nexus']) {
      const d = allSteps[ds]
      if (!d) continue
      const items = d.questions || d.issues || d.questionable_assumptions || d.dependencies || []
      // Support both lowercase (devil-framework/simulate/nexus) and uppercase (devil-model) severity
      const highItems = items.filter(i => i.severity === 'high' || i.severity === 'HIGH' || i.severity === 'CRITICAL')
      if (highItems.length > 0) {
        parts.push(`${ds} 高级别质疑：${JSON.stringify(highItems.map(i => i.description || i.risk_if_false))}`)
      }
    }
    // Monte Carlo results
    const mc = allSteps.simulate || {}
    if (mc.ranking && mc.ranking.length > 0) {
      parts.push(`蒙特卡洛排名：${JSON.stringify(mc.ranking)}`)
    }
    // Nexus confidence reason
    const nexus = allSteps.nexus || {}
    if (nexus.confidence_level) {
      parts.push(`nexus 置信度：${nexus.confidence_level}，理由：${nexus.caveats ? JSON.stringify(nexus.caveats) : '无'}`)
    }
    return parts.join('\n')
  }

  for (let i = fromStepIdx; i < PIPELINE_STEPS.length; i++) {
    const step = PIPELINE_STEPS[i]
    await sendEvent('step', { step: step.name, status: 'running' })
    console.log(`[Pipeline] Step "${step.name}" started`)

    // simulate step: run Monte Carlo simulation
    if (step.name === 'simulate') {
      const model = steps['build-model'] || {}
      const simSpec = {
        variables: (model.variables || []).map(v => ({
          name: v.name,
          sim_spec: v.sim_spec,
          weight: model.weights?.[v.name] ?? 0,
        })),
        options: (model.treeData?.children || []).map(child => ({
          name: child.name,
          base_score: child.value ?? 50,
          trade_offs: child.logic_payload?.trade_offs || [],
          risk_adjustment: child.logic_payload?.risk_adjustment || null,
        })),
        riskPreference: pipelineState[pipelineId].riskPreference || '均衡',
      }
      const mcResult = runMonteCarlo(simSpec, 5000)
      pipelineState[pipelineId].steps.simulate = mcResult
      pipelineState[pipelineId].lastStep = step.name
      await sendEvent('step', { step: 'simulate', status: 'completed' })
      console.log('[Pipeline] Monte Carlo simulation completed:', mcResult.ranking)
      continue
    }

    let userPrompt = userInput

    // Validate model data after build-model completes, collect quantitative issues
    if (step.name === 'build-model') {
      const model = steps['build-model'] || {}
      const validationResults = validateModel(model)
      if (validationResults.length > 0) {
        pipelineState[pipelineId].validationResults = validationResults
        const errorCount = validationResults.filter(e => e.severity === 'error').length
        const warningCount = validationResults.filter(e => e.severity === 'warning').length
        console.log(`[Pipeline] build-model validation: ${errorCount} errors, ${warningCount} warnings`)
      }
    }

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
      const validationErrors = (pipelineState[pipelineId].validationResults || []).filter(e => e.severity === 'error')
      const validationWarnings = (pipelineState[pipelineId].validationResults || []).filter(e => e.severity === 'warning')
      const validationSummary = [...validationErrors, ...validationWarnings].length > 0
        ? `定量校验发现：${JSON.stringify(pipelineState[pipelineId].validationResults || [])}`
        : ''
      userPrompt = `模型概览：
- 选项：${JSON.stringify(model.options)}
- 基准分：${JSON.stringify(model.scores)}
- 权重：${JSON.stringify(model.weights)}
- 变量（含分布类型与权重）：${JSON.stringify(variables)}
- 选项权衡分析：${JSON.stringify((model.treeData?.children || []).map(child => ({ name: child.name, base_score: model.scores?.[child.name] ?? 50, trade_offs: child.logic_payload?.trade_offs || [] })))}
- 框架定义：${JSON.stringify(steps.framework || {})}
${validationSummary ? `\n- 定量校验结果：${validationSummary}` : ''}`
    } else if (step.name === 'devil-simulate') {
      const model = steps['build-model'] || {}
      const mcResult = steps.simulate || {}
      const validationSummary = (pipelineState[pipelineId].validationResults || []).length > 0
        ? `\n- 定量校验结果：${JSON.stringify(pipelineState[pipelineId].validationResults)}`
        : ''
      userPrompt = `仿真模型概览：
- 变量与分布：${JSON.stringify((model.variables || []).map(v => ({ name: v.name, sim_spec: v.sim_spec })))}
- 权重：${JSON.stringify(model.weights)}
- 蒙特卡洛仿真结果：${JSON.stringify({
  ranking: mcResult.ranking || [],
  optionResults: mcResult.optionResults || {},
})}
${steps['devil-framework'] ? `\n- 框架审查意见：${JSON.stringify(steps['devil-framework'])}` : ''}
${steps['devil-model'] ? `\n- 模型审查意见：${JSON.stringify(steps['devil-model'])}` : ''}${validationSummary}`
    } else if (step.name === 'devil-nexus') {
      const mcResult = steps.simulate || {}
      userPrompt = `最终决策结论：${JSON.stringify(steps.nexus || {})}
所有审查意见汇总：
- 框架审查：${JSON.stringify(steps['devil-framework'] || {})}
- 模型审查：${JSON.stringify(steps['devil-model'] || {})}
- 仿真审查：${JSON.stringify(steps['devil-simulate'] || {})}
- 蒙特卡洛仿真结果：${JSON.stringify(mcResult.ranking || {})}`
    } else if (step.name === 'framework') {
      if (currentModel) {
        userPrompt = `用户问题：${userInput}
已有决策模型供参考（请在其基础上细化维度，不要从零开始）：
- 选项：${JSON.stringify(currentModel.options)}
- 变量：${JSON.stringify(currentModel.variables?.map(v => ({ name: v.name, type: v.type })))}
- 权重：${JSON.stringify(currentModel.weights)}`
      }
    } else if (step.name === 'build-model') {
      if (devilDirectives) {
        // Inner loop: inject correction directives
        userPrompt = `### 内回路修正指令
你的上一次建模发现了以下关键问题，请修正模型：
${JSON.stringify(devilDirectives)}

### 原始问题
${userInput}

### 框架定义
${JSON.stringify(steps.framework || {})}

### 修正原则
1. 只修不造：保持 options 列表不变，只修改 treeData、variables、weights 内部细节
2. 逐条回应上述修正指令
3. 保持结构一致
`
        devilDirectives = null // consumed
      } else if (defeatContext) {
        // Outer loop: inject defeat context
        userPrompt = `### 外回路重塑指令（败因上下文）
上一次建模的置信度不足，请基于以下败因分析重新建模：
${defeatContext}

### 原始问题
${userInput}

### 框架定义
${JSON.stringify(steps.framework || {})}

### 修正原则
1. 只修不造：保持 options 列表不变
2. 针对败因上下文中指出的问题进行修正
3. 保持结构一致
`
        defeatContext = null // consumed
      } else if (currentModel) {
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
      // Monte Carlo ranking stability
      const mcResult = steps.simulate || {}
      const mcRanking = mcResult.ranking || []
      const mcSigmaAvg = Object.values(mcResult.optionResults || {}).reduce((sum, opt) => sum + (opt.sigma || 0), 0) / Math.max(1, Object.keys(mcResult.optionResults || {}).length)
      const confidenceSignals = `
### 置信度判断信号（供 LLM 综合评估 0-100）
- 第一名与第二名分差：${scoreGap.toFixed(1)}
- 审查问题统计：high=${devilCounts.high}, medium=${devilCounts.medium}, low=${devilCounts.low}
- 路径概率总和：${probSum.toFixed(2)}
- 蒙特卡洛仿真结果排名：${JSON.stringify(mcRanking)}
- 蒙特卡洛平均标准差：${mcSigmaAvg.toFixed(1)}
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

      // build-model 步骤产出后必须走 sanitizeModel（定性标签转换、归一化等）
      if (step.name === 'build-model') {
        result = sanitizeModel(result)
      }

      pipelineState[pipelineId].steps[step.name] = result
      pipelineState[pipelineId].lastStep = step.name

      // Inner loop: after devil-model, check for correction trigger
      if (step.name === 'devil-model') {
        const review = sanitizeDevilReview(result)
        const validationResults = pipelineState[pipelineId].validationResults || []
        const validationErrors = validationResults.filter(e => e.severity === 'error')
        // Probability sum warnings are actionable data integrity issues
        const actionableWarnings = validationResults.filter(e =>
          e.severity === 'warning' && (e.field === 'paths' || (e.message && e.message.includes('概率'))),
        )
        const shouldInnerLoop = (review.requires_refactor && review.severity === 'CRITICAL') || validationErrors.length > 0 || actionableWarnings.length > 0

        if (shouldInnerLoop && innerLoopCount === 0) {
          innerLoopCount++
          pipelineState[pipelineId].innerLoopCount = innerLoopCount
          devilDirectives = review.directives || []
          if (validationErrors.length > 0 || actionableWarnings.length > 0) {
            const issues = [...validationErrors, ...actionableWarnings].map(e => e.message).join('；')
            devilDirectives.push({
              target: 'validation',
              action: 'fix',
              reason: `定量校验发现问题：${issues}`,
            })
          }
          await sendEvent('status', { status: 'inner-loop-running', text: '发现关键问题，正在自我校准...' })
          console.log('[Pipeline] Inner loop triggered, backtracking to build-model')
          // Re-execute build-model step with correction directives
          i = PIPELINE_STEPS.findIndex(s => s.name === 'build-model') - 1 // will increment to build-model in next iteration
          continue
        } else if (shouldInnerLoop && innerLoopCount >= 1) {
          pipelineState[pipelineId].innerLoopSkipped = true
          console.log('[Pipeline] Inner loop skipped (already ran once)')
        }
      }

      // Outer loop: after nexus, keep re-running until confidence >= 60 or max retries reached
      if (step.name === 'nexus') {
        const confidence = result?.confidence_level
        if (typeof confidence === 'number' && confidence < 60 && outerLoopCount < MAX_OUTER_LOOP) {
          while (outerLoopCount < MAX_OUTER_LOOP) {
            outerLoopCount++
            pipelineState[pipelineId].outerLoopCount = outerLoopCount
            defeatContext = buildDefeatContext(steps)

            const iterationLabel = outerLoopCount === 1 ? 'v2' : `v${outerLoopCount + 1}`
            await sendEvent('status', { status: 'outer-loop-running', text: `置信度不足，正在第 ${outerLoopCount} 次重塑模型...` })
            console.log(`[Pipeline] Outer loop #${outerLoopCount} triggered, re-running trimmed pipeline`)

            const trimmedSteps = ['build-model', 'simulate', 'nexus']
            for (const ts of trimmedSteps) {
              delete steps[ts]
              await sendEvent('step', { step: `${ts} (${iterationLabel})`, status: 'running' })

              if (ts === 'simulate') {
                const model = steps['build-model'] || {}
                const simSpec = {
                  variables: (model.variables || []).map(v => ({
                    name: v.name,
                    sim_spec: v.sim_spec,
                    weight: model.weights?.[v.name] ?? 0,
                  })),
                  options: (model.treeData?.children || []).map(child => ({
                    name: child.name,
                    base_score: child.value ?? 50,
                    trade_offs: child.logic_payload?.trade_offs || [],
                    risk_adjustment: child.logic_payload?.risk_adjustment || null,
                  })),
                  riskPreference: state.riskPreference || '均衡',
                }
                const mcResult = runMonteCarlo(simSpec, 5000)
                steps.simulate = mcResult
                steps.lastStep = ts
                await sendEvent('step', { step: `${ts} (${iterationLabel})`, status: 'completed' })
                continue
              }

              if (ts === 'build-model') {
                const accumulatedCritique = outerLoopCount > 1
                  ? `\n### 历史重塑记录\n此前已进行 ${outerLoopCount - 1} 次模型重塑，置信度仍未达标。请彻底反思当前建模范式，避免重复同样的错误。\n`
                  : ''
                const bmPrompt = `### 外回路重塑指令（败因上下文）
上一次建模的置信度不足，请基于以下败因分析重新建模：
${defeatContext}
${accumulatedCritique}
### 原始问题
${userInput}

### 框架定义
${JSON.stringify(steps.framework || {})}

### 修正原则
1. 只修不造：保持 options 列表不变
2. 针对败因上下文中指出的问题进行修正
3. 保持结构一致
`
                let bmResult = await callQwen(DECISION_MODEL_DEEP_PROMPT, bmPrompt, DECISION_MODEL, 2, false)
                if (Array.isArray(bmResult)) bmResult = bmResult[0]
                bmResult = sanitizeModel(bmResult)
                steps['build-model'] = bmResult
                const v2Validation = validateModel(bmResult)
                if (v2Validation.length > 0) {
                  pipelineState[pipelineId].v2ValidationErrors = v2Validation
                  console.log(`[Pipeline] V2#${outerLoopCount} validation: ${v2Validation.filter(e => e.severity === 'error').length} errors`)
                }
                state.lastStep = ts
                await sendEvent('step', { step: `${ts} (${iterationLabel})`, status: 'completed' })
              } else if (ts === 'nexus') {
                const model = steps['build-model'] || {}
                const scoreVals = Object.values(model.scores || {}).filter(v => typeof v === 'number')
                const sorted2 = scoreVals.sort((a, b) => b - a)
                const scoreGap = sorted2.length >= 2 ? sorted2[0] - sorted2[1] : 0
                const pathProbs = (model.paths || []).filter(p => typeof p.probability === 'number').map(p => p.probability)
                const probSum = pathProbs.length > 0 ? pathProbs.reduce((a, b) => a + b, 0) : 0
                const mcResult = steps.simulate || {}
                const mcRanking = mcResult.ranking || []
                const mcSigmaAvg = Object.values(mcResult.optionResults || {}).reduce((sum, opt) => sum + (opt.sigma || 0), 0) / Math.max(1, Object.keys(mcResult.optionResults || {}).length)
                const v2Errors = pipelineState[pipelineId].v2ValidationErrors || []
                const v2ErrorCount = v2Errors.filter(e => e.severity === 'error').length
                const overrideReason = v2ErrorCount > 0
                  ? `- **数据异常报警**：重塑后定量校验发现 ${v2ErrorCount} 个错误，系统已介入安全干预\n`
                  : ''
                const confidenceSignals2 = `
### 置信度判断信号
- 第一名与第二名分差：${scoreGap.toFixed(1)}
- 路径概率总和：${probSum.toFixed(2)}
- 蒙特卡洛仿真结果排名：${JSON.stringify(mcRanking)}
- 蒙特卡洛平均标准差：${mcSigmaAvg.toFixed(1)}
${overrideReason ? `\n- **安全干预**：${overrideReason}` : ''}
`
                const v2Critique = v2ErrorCount > 0
                  ? `\n### 量化基础批判（系统强制）\n底层因果图发生断头路，量化底座失效。校验发现以下错误：${JSON.stringify(v2Errors.filter(e => e.severity === 'error').map(e => e.message))}。请在报告中明确批判模型的量化基础。`
                  : ''
                const nexusPrompt = `综合所有分析结果，生成最终决策报告。
模型：${JSON.stringify(model)}
${confidenceSignals2}${v2Critique}`
                let nexusResult = await callQwen(DECISION_NEXUS_PROMPT, nexusPrompt, DECISION_MODEL, 1, false)
                if (Array.isArray(nexusResult)) nexusResult = nexusResult[0]
                if (v2ErrorCount > 0) {
                  nexusResult.confidence_level = Math.min(nexusResult.confidence_level || 100, 40)
                  nexusResult.override_reason = '底层因果图发生断头路，量化底座失效'
                }
                steps.nexus = nexusResult
                state.lastStep = ts
                await sendEvent('step', { step: `${ts} (${iterationLabel})`, status: 'completed' })
              }
            }

            const newNexus = steps.nexus || {}
            const newConfidence = newNexus.confidence_level
            console.log(`[Pipeline] Outer loop #${outerLoopCount} completed, confidence:`, newConfidence)

            if (typeof newConfidence === 'number' && newConfidence >= 60) {
              console.log('[Pipeline] Confidence threshold reached (>=60), exiting outer loop')
              break
            }

            if (outerLoopCount >= MAX_OUTER_LOOP) {
              pipelineState[pipelineId].outerLoopLowConfidence = true
              console.log(`[Pipeline] Max outer loop (${MAX_OUTER_LOOP}) reached, confidence still below 60:`, newConfidence)
            }
          }

          await sendEvent('step', { step: 'nexus', status: 'completed' })
          break
        } else if (typeof confidence === 'number' && confidence < 60 && outerLoopCount >= MAX_OUTER_LOOP) {
          pipelineState[pipelineId].outerLoopSkipped = true
          console.log('[Pipeline] Outer loop skipped (max retries reached)')
        }
      }
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
          winner_vulnerability: 'Mock: 排名第一的方案过于依赖单一有利条件',
          loser_defense: 'Mock: 排名最后的方案在特定情景下可能被低估',
          summary: 'Mock: 结论依赖多个不确定前提',
        }
      } else {
        pipelineState[pipelineId].steps[step.name] = data
      }
      pipelineState[pipelineId].lastStep = step.name
    }

    await sendEvent('step', { step: step.name, status: 'completed' })
    console.log(`[Pipeline] Step "${step.name}" completed`)
  }
}
// POST /full-pipeline: Run all 5 steps with SSE progress
// If currentModel is provided, enters deep-validation mode (keeps options/weights unchanged)
router.post('/full-pipeline', async (req, res) => {
  const { userInput, currentModel, riskPreference } = req.body
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

  const sendEvent = async (event, data) => {
    if (!res.writableEnded) {
      const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
      const ok = res.write(chunk)
      if (!ok) {
        await new Promise(resolve => res.once('drain', resolve))
      }
    }
  }

  try {
    pipelineState[id] = { id, steps: {}, lastStep: null, status: 'running', userInput, riskPreference: riskPreference || '均衡', createdAt: Date.now() }
    cleanupPipelineState()

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

// POST /correct-model: Manual correction endpoint
router.post('/correct-model', async (req, res) => {
  const { pipelineId, paramValues } = req.body
  if (!pipelineId) {
    return res.status(400).json({ error: 'pipelineId is required' })
  }

  const state = pipelineState[pipelineId]
  if (!state || !state.steps['build-model']) {
    return res.status(404).json({ error: 'Pipeline not found or no model available' })
  }

  const model = state.steps['build-model']
  const defeatContext = buildDefeatContextForCorrection(state.steps)

  console.log('[Pipeline] Manual correction started for:', pipelineId)

  if (USE_REAL_LLM) {
    try {
      // Build user preference context from paramValues
      const userPrefs = paramValues && Object.keys(paramValues).length
        ? `\n### 用户当前偏好参数\n${JSON.stringify(paramValues)}\n修正时请考虑用户偏好，调整权重分配和 trade_offs 方向。\n`
        : ''

      const correctionPrompt = `### 外回路重塑指令（败因上下文）
上一次建模的置信度不足，请基于以下败因分析重新建模：
${defeatContext}

### 原始问题
${state.userInput || ''}

### 框架定义
${JSON.stringify(state.steps.framework || {})}
${userPrefs}
### 修正原则
1. 只修不造：保持 options 列表不变
2. 针对败因上下文中指出的问题进行修正
3. 保持结构一致
`
      let result = await callQwen(DECISION_MODEL_DEEP_PROMPT, correctionPrompt, DECISION_MODEL, 2, false)
      if (Array.isArray(result)) result = result[0]

      // Validate
      const validationErrors = validateModel(result)
      const hasError = validationErrors.some(e => e.severity === 'error')
      const warnings = validationErrors.filter(e => e.severity === 'warning')
      if (hasError) {
        return res.status(400).json({ errors: validationErrors })
      }

      result = sanitizeModel(result)
      // Update pipeline state with corrected model
      state.steps['corrected-model'] = result
      state.lastStep = 'correct-model'
      return res.json({ pipelineId, result, warnings })
    } catch (err) {
      console.error('[Pipeline] Manual correction failed:', err.message)
      return res.status(500).json({ error: 'Correction failed', detail: err.message })
    }
  }

  // Mock mode: return slightly modified model
  if (mockData) {
    let data = mockData
    if (Array.isArray(data)) data = data[0]
    state.steps['corrected-model'] = data
    state.lastStep = 'correct-model'
    return res.json({ pipelineId, result: data })
  }
  res.status(500).json({ error: 'Mock data not available' })
})

// Helper to build defeat context for manual correction
function buildDefeatContextForCorrection(allSteps) {
  const parts = []
  for (const ds of ['devil-framework', 'devil-model', 'devil-simulate', 'devil-nexus']) {
    const d = allSteps[ds]
    if (!d) continue
    const items = d.questions || d.issues || d.questionable_assumptions || d.dependencies || []
    const highItems = items.filter(i => i.severity === 'high')
    if (highItems.length > 0) {
      parts.push(`${ds} 高级别质疑：${JSON.stringify(highItems.map(i => i.description || i.risk_if_false))}`)
    }
  }
  const mc = allSteps.simulate || {}
  if (mc.ranking && mc.ranking.length > 0) {
    parts.push(`蒙特卡洛排名：${JSON.stringify(mc.ranking)}`)
  }
  const nexus = allSteps.nexus || {}
  if (nexus.confidence_level) {
    parts.push(`nexus 置信度：${nexus.confidence_level}`)
  }
  return parts.join('\n') || '无具体败因信息'
}

export default router
