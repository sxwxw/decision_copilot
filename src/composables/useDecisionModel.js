import { reactive, computed, ref } from 'vue'
import { createDecisionModel, simulateModel, refineModel, validateInput, devilReview, runFramework, runBuildModel, runFullPipeline } from '../api/decision'
import { Decimal } from 'decimal.js'
import { ElMessage } from 'element-plus'
import { runMonteCarlo as runMC } from '../utils/simulator.js'

// ── 本地持久化 ──

const STORAGE_KEY = 'decision-copilot-state'
const STORAGE_VERSION = 1

function saveToStorage() {
  if (!state.model) return
  console.log('[Persistence] 保存模型到 localStorage')
  const payload = {
    version: STORAGE_VERSION,
    timestamp: Date.now(),
    userInput: state.savedInput,
    model: state.model,
    paramValues: state.paramValues,
    adjustedProbabilities: state.adjustedProbabilities,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.error('[Persistence] 存储失败:', err)
  }
}

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  console.log('[Persistence] 发现本地缓存，尝试恢复')
  try {
    const data = JSON.parse(raw)
    if (data.version !== STORAGE_VERSION) {
      console.warn(`[Persistence] 版本不匹配 (local=${data.version}, current=${STORAGE_VERSION})，清除旧数据`)
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    if (!data.model || !data.model.treeData) {
      console.warn('[Persistence] 数据结构不完整，清除')
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return data
  } catch (err) {
    console.error('[Persistence] 解析失败，清除:', err)
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY)
  console.log('[Persistence] 本地缓存已清除')
}

// ── 前端校验层：与服务端共享相同规则 ──

function validateModel(raw) {
  const errors = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push({ field: '*', message: '模型数据格式错误', severity: 'error' })
    return errors
  }

  const options = Array.isArray(raw.options) ? raw.options : []
  const weights = raw.weights && typeof raw.weights === 'object' ? raw.weights : {}
  const scores = raw.scores && typeof raw.scores === 'object' ? raw.scores : {}
  const paths = Array.isArray(raw.paths) ? raw.paths : []
  const variables = Array.isArray(raw.variables) ? raw.variables.map(v => v.name) : []

  // 结构完整性
  if (options.length < 2) {
    errors.push({ field: 'options', message: '至少需要 2 个选项', severity: 'error' })
  }

  // 范围校验
  for (const [key, val] of Object.entries(weights)) {
    if (typeof val !== 'number' || val < 0 || val > 1) {
      errors.push({ field: `weights.${key}`, message: `权重 ${key} 超出 [0, 1] 范围 (${val})`, severity: 'error' })
    }
  }
  for (const [key, val] of Object.entries(scores)) {
    if (typeof val !== 'number' || val < 0 || val > 100) {
      errors.push({ field: `scores.${key}`, message: `分数 ${key} 超出 [0, 100] 范围 (${val})`, severity: 'error' })
    }
  }
  for (let i = 0; i < paths.length; i++) {
    const prob = paths[i].probability
    if (typeof prob === 'number' && (prob < 0 || prob > 1)) {
      errors.push({ field: `paths[${i}].probability`, message: '概率超出 [0, 1] 范围', severity: 'error' })
    }
  }

  // 语义一致性（warning）：每个 option 下的路径概率之和 ≈ 1.0
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
  const weightVals = Object.values(weights).filter(v => typeof v === 'number')
  if (weightVals.length > 0) {
    const wSum = weightVals.reduce((a, b) => a + b, 0)
    if (Math.abs(wSum - 1.0) > 0.05) {
      errors.push({ field: 'weights', message: `权重总和为 ${wSum.toFixed(2)}，应 ≈ 1.0`, severity: 'warning' })
    }
  }

  return errors
}

// ── 数据清洗器：结构格式化 + 语义索引 ──

function sanitizeModel(rawData) {
  if (!rawData || typeof rawData !== 'object') return null

  const d = { ...rawData }

  console.group('[Sanitizer] ===== 开始清洗 =====')

  // ── Step 1: 结构格式化 ──

  // 1a. options 确保为数组
  d.options = Array.isArray(d.options) ? d.options : []
  console.log('[Sanitizer] options:', JSON.stringify(d.options))

  // 1b. variables 从 weights key 构造，但保留 LLM 原始变量中的 sim_spec
  if (d.weights && typeof d.weights === 'object') {
    const varKeys = Object.keys(d.weights)
    const RISK_PREFERENCE = '风险偏好'
    const otherKeys = varKeys.filter(k => k !== RISK_PREFERENCE)
    const originalVarMap = Array.isArray(rawData.variables)
      ? Object.fromEntries(rawData.variables.map(v => [v.name, v]))
      : {}
    d.variables = [
      ...otherKeys.map(name => {
        const orig = originalVarMap[name]
        return {
          name,
          type: orig?.type || 'slider',
          range: orig?.range || [0, 100],
          sim_spec: orig?.sim_spec,
        }
      }),
      {
        name: RISK_PREFERENCE,
        type: 'select',
        options: ['保守', '均衡', '激进'],
        sim_spec: originalVarMap[RISK_PREFERENCE]?.sim_spec || {
          type: 'categorical',
          params: { values: ['保守', '均衡', '激进'], probabilities: [0.25, 0.5, 0.25] },
        },
      },
    ]
  } else {
    d.variables = []
  }

  // 1c. weights key ⊆ variables.name
  const validVarNames = new Set(d.variables.map(v => v.name))
  console.log('[Sanitizer] 合法变量名:', [...validVarNames])
  const weightsBefore = d.weights
  d.weights = d.weights && typeof d.weights === 'object'
    ? Object.fromEntries(Object.entries(d.weights).filter(([k]) => validVarNames.has(k)))
    : {}
  if (JSON.stringify(weightsBefore) !== JSON.stringify(d.weights)) {
    console.warn('[Sanitizer] weights 被过滤:', { before: weightsBefore, after: d.weights })
  }

  // 1d. scores key ⊆ options
  const validOptions = new Set(d.options)
  const scoresBefore = d.scores
  d.scores = d.scores && typeof d.scores === 'object'
    ? Object.fromEntries(Object.entries(d.scores).filter(([k]) => validOptions.has(k)))
    : {}
  for (const opt of d.options) {
    if (d.scores[opt] === undefined) d.scores[opt] = 50
  }
  if (JSON.stringify(scoresBefore) !== JSON.stringify(d.scores)) {
    console.warn('[Sanitizer] scores 被修正:', { before: scoresBefore, after: d.scores })
  }

  // 1e. trade_offs.dimension ⊆ variables.name（递归遍历 treeData）
  let tradeOffsRemoved = 0
  function sanitizeTradeOffs(node) {
    if (node.logic_payload?.trade_offs) {
      const before = node.logic_payload.trade_offs.length
      node.logic_payload.trade_offs = node.logic_payload.trade_offs
        .filter(t => validVarNames.has(t.dimension))
      const after = node.logic_payload.trade_offs.length
      if (after < before) {
        tradeOffsRemoved += before - after
        console.warn(`[Sanitizer] 节点 "${node.name}" trade_offs 被移除 ${before - after} 项:`, node.logic_payload.trade_offs)
      }
    }
    if (node.children) {
      for (const child of node.children) sanitizeTradeOffs(child)
    }
  }
  if (d.treeData) sanitizeTradeOffs(d.treeData)
  if (tradeOffsRemoved > 0) console.warn(`[Sanitizer] 共移除 ${tradeOffsRemoved} 个非法 trade_offs`)

  // 1g. 加权推导缺失维度的 trade_offs
  if (d.treeData && Array.isArray(d.paths)) {
    deriveTradeoffs(d.treeData, d.paths)
  }

  // 1f. paths[].impact.key ⊆ variables.name
  if (Array.isArray(d.paths)) {
    for (const path of d.paths) {
      if (path.timeline) {
        for (const evt of path.timeline) {
          if (evt.impact) {
            const before = Object.keys(evt.impact)
            evt.impact = Object.fromEntries(Object.entries(evt.impact).filter(([k]) => validVarNames.has(k)))
            const after = Object.keys(evt.impact)
            if (before.length !== after.length) {
              console.warn(`[Sanitizer] path "${path.id}" event "${evt.event}" impact 被过滤:`, { before, after })
            }
          }
          if (evt.threshold) {
            evt.threshold = Object.fromEntries(Object.entries(evt.threshold).filter(([k]) => validVarNames.has(k)))
          }
        }
      }
    }
  }

  /**
 * 从缺失的维度推导 option 级 trade_offs。
 * 如果某维度有权重但不在 option trade_offs 中，
 * 从其子节点（L1）的 trade_offs 中按路径概率加权平均推导。
 */
function deriveTradeoffs(treeData, paths) {
  if (!treeData?.children || !paths?.length) return

  // 构建 path 名称到 L1 事件名的映射：{optionName: {l1EventName: pathProbability}}
  const optionL1Probs = {}
  for (const path of paths) {
    const segments = path.name.split('→').map(s => s.trim()).filter(Boolean)
    if (segments.length < 2) continue
    const optionName = segments[0]
    const l1Event = segments[1]
    if (!optionL1Probs[optionName]) optionL1Probs[optionName] = {}
    optionL1Probs[optionName][l1Event] = path.probability ?? 0
  }

  for (const optionNode of treeData.children) {
    if (!optionNode.logic_payload?.trade_offs) continue
    const existingDims = new Set(optionNode.logic_payload.trade_offs.map(t => t.dimension))
    const l1Probs = optionL1Probs[optionNode.name] || {}

    // 遍历 L1 子节点，收集它们 trade_offs 中所有出现过的维度
    const l1Children = optionNode.children || []
    for (const l1 of l1Children) {
      if (!l1.logic_payload?.trade_offs) continue
      for (const t of l1.logic_payload.trade_offs) {
        if (existingDims.has(t.dimension)) continue // 已有，跳过

        // 该维度在 option 级缺失，推导
        const dimName = t.dimension
        let weightedSum = 0
        let probTotal = 0

        // 遍历所有 L1 子节点，收集该维度的 delta
        for (const child of l1Children) {
          const childTradeOffs = child.logic_payload?.trade_offs || []
          const childEntry = childTradeOffs.find(c => c.dimension === dimName)
          if (!childEntry) continue

          // 用 path.name 中对应 L1 事件匹配概率
          const prob = l1Probs[child.name]
          if (prob != null) {
            weightedSum += childEntry.delta * prob
            probTotal += prob
          }
        }

        // 推导结果
        const derivedDelta = probTotal > 0
          ? Math.round((weightedSum / probTotal) * 100) / 100
          : 0

        optionNode.logic_payload.trade_offs.push({
          dimension: dimName,
          delta: derivedDelta,
        })
        existingDims.add(dimName)

        console.log(`[Sanitizer] deriveTradeoffs: 为 "${optionNode.name}" 补全维度 "${dimName}", delta=${derivedDelta}`)
      }
    }
  }
}

// ── Step 2: 语义索引（构建 _pathRef） ──
  console.log('[Sanitizer] 开始语义索引...')
  if (d.treeData && Array.isArray(d.paths)) {
    buildPathRefs(d.treeData, d.paths, d.options)

    // 打印索引结果
    const refResult = {}
    function collectRefs(node, path) {
      if (node._pathRef) refResult[path + node.name] = node._pathRef
      if (node.children) {
        for (const child of node.children) collectRefs(child, path + node.name + ' → ')
      }
    }
    collectRefs(d.treeData, '')
    console.log('[Sanitizer] _pathRef 注入结果:', refResult)
  }

  console.groupEnd()
  return d
}

/**
 * 为 treeData 的每个节点注入 _pathRef 数组
 * 匹配策略：精确匹配 → 双向包含 → 位置回退
 */
function buildPathRefs(treeData, paths, options) {
  // 构建 optionName → 子节点扁平列表 的映射
  const optionNodes = {}
  for (const optChild of treeData.children || []) {
    optionNodes[optChild.name] = flattenTree(optChild, 1)
  }

  for (const path of paths) {
    const events = extractEvents(path)
    if (!events.length) continue

    // 第一段：匹配 option
    const optionName = events[0]
    const matchedOption = treeData.children?.find(c => c.name === optionName)
    if (!matchedOption) {
      console.warn(`[Sanitizer] 无法匹配路径选项 "${optionName}"，跳过 path ${path.id}`)
      continue
    }

    // 给 option 节点注入 _pathRef
    if (!matchedOption._pathRef) matchedOption._pathRef = []
    matchedOption._pathRef.push(path.id)

    // 后续段：匹配子节点
    const childNodes = optionNodes[matchedOption.name] || []
    for (let i = 1; i < events.length; i++) {
      const eventName = events[i]
      const matched = matchNode(childNodes, eventName, i - 1)
      if (matched) {
        if (!matched._pathRef) matched._pathRef = []
        matched._pathRef.push(path.id)
      }
    }
  }
}

/** 扁平化树为节点数组（含层级索引） */
function flattenTree(node, depth) {
  const result = []
  if (node.children) {
    node.children.forEach((child, idx) => {
      child._depth = depth
      child._index = idx
      result.push(child)
      result.push(...flattenTree(child, depth + 1))
    })
  }
  return result
}

/** 从 path 中提取事件名链条 */
function extractEvents(path) {
  // 优先用 path.name 按 → 分割（与 treeData 节点名一致）
  if (path.name) {
    return path.name.split('→').map(s => s.trim()).filter(Boolean)
  }
  // 回退：用 timeline 事件名
  if (path.timeline && path.timeline.length) {
    return path.timeline.map(e => e.event).filter(Boolean)
  }
  return []
}

/** 匹配策略：精确 → 包含 → 位置回退 */
function matchNode(nodeList, eventName, fallbackIndex) {
  // 1. 精确匹配
  const exact = nodeList.find(n => n.name === eventName)
  if (exact) return exact

  // 2. 双向包含
  const partial = nodeList.find(n =>
    n.name.includes(eventName) || eventName.includes(n.name))
  if (partial) return partial

  // 3. 位置回退
  console.warn(`[Sanitizer] 无法匹配路径事件 "${eventName}" 到树节点，回退至位置索引 [${fallbackIndex}]`)
  return nodeList[fallbackIndex] || null
}

// ── 适配器：将 LLM 输出的毛坯数据标准化为组件契约 ──
let _idCounter = 0
function genId() {
  return `n-${++_idCounter}`
}

function adaptTree(rawTree, rawPaths) {
  _idCounter = 0

  // 1) 构建 event→probability 映射（保留：从 paths 计算每个事件的累积概率）
  const eventProbMap = {}
  if (rawPaths && rawPaths.length) {
    for (const path of rawPaths) {
      if (!path.timeline) continue
      let cumulative = new Decimal(1)
      for (const evt of path.timeline) {
        cumulative = cumulative.mul(evt.probability ?? 1.0)
        if (evt.event) {
          const cVal = cumulative.toDecimalPlaces(2).toNumber()
          if (!eventProbMap[evt.event] || eventProbMap[evt.event] < cVal) {
            eventProbMap[evt.event] = cVal
          }
        }
      }
    }
  }

  // 2) 递归遍历树，标准化字段
  function adaptNode(node, depth, optionName) {
    const step = depth
    const rawName = node.name ?? ''
    const cleanName = rawName.replace(/^第[0-9]+年[：:]\s*/, '')

    // 概率：优先从 eventProbMap 按节点名查找，回退到 node.value / 100
    let probability = eventProbMap[cleanName]
    if (probability === undefined) {
      probability = (node.value ?? 50) / 100
    }
    probability = Math.max(0, Math.min(1, parseFloat(probability.toFixed(2))))

    // _pathRef → pathIds（语义索引的结果）
    const pathIds = Array.isArray(node._pathRef) ? [...node._pathRef] : []

    const adapted = {
      id: genId(),
      name: cleanName,
      step,
      score: node.value ?? 50,
      status: node.eventType || null,
      probability,
      isDashed: step >= 2,
      children: [],
      pathIds,
    }

    if (node.logic_payload) {
      adapted.logic_payload = node.logic_payload
    }

    if (node.children && node.children.length) {
      for (const child of node.children) {
        adapted.children.push(adaptNode(child, depth + 1, step === 0 ? cleanName : optionName))
      }
    }

    return adapted
  }

  const adapted = adaptNode(rawTree, 0, null)

  // 根节点始终包含所有 pathId
  if (rawPaths && rawPaths.length) {
    adapted.pathIds = rawPaths.map(p => p.id)
  }

  return adapted
}

const state = reactive({
  userInput: '',
  savedInput: '',   // last submitted question, used by deep simulate
  riskPreference: '均衡', // 风险偏好：保守/均衡/激进
  loading: false,
  model: null,       // { options, variables, weights, treeData, paths, recommendation, scores }
  selectedNode: null,
  paramValues: {},   // current param values for recalc
  snapshotWeights: null, // snapshot of param values at time of last refine (for incremental scoring)
  adjustedProbabilities: {}, // pathId -> adjusted probability
  monteCarloResult: null, // { optionResults, ranking }
  devilResult: null, // DEVIL 对抗性审查结果
  devilLoading: false, // DEVIL 请求中
  // Pipeline state
  pipelineId: null,
  pipelineStatus: 'idle', // idle | running | completed | failed
  pipelineCurrentStep: null,
  pipelineCompletedSteps: [],
  pipelineResult: null,
  pipelineMode: 'quick-build', // quick-build | deep-validation
})

export function useDecisionModel() {
  /**
   * 恢复本地持久化的模型数据。
   * 定义在 useDecisionModel 内部以访问 selectNode。
   */
  function tryRestoreFromStorage() {
    const data = loadFromStorage()
    if (!data) return

    console.log('[Persistence] 恢复本地缓存模型')
    state.userInput = data.userInput || ''
    state.savedInput = data.userInput || ''
    state.riskPreference = data.riskPreference || '均衡'
    state.model = data.model
    state.paramValues = data.paramValues || {}
    state.adjustedProbabilities = data.adjustedProbabilities || {}

    // 恢复 treeData 适配和 _version
    if (state.model.treeData) {
      if (!state.model.treeData.pathIds && state.model.paths) {
        state.model.treeData = adaptTree(state.model.treeData, state.model.paths)
      }
      state.model.treeData._version = 0
    }

    state.selectedNode = null
    selectNode(state.model.treeData)

    ElMessage.success('已恢复上次决策模型')
  }

  // 初始化：检查本地缓存并恢复
  tryRestoreFromStorage()

  /**
   * 构建敏感度映射表：方案名 → { 维度名 → delta }
   * 从 treeData.children（第一层方案节点）的 logic_payload.trade_offs 提取。
   */
  function buildSensitivityMap() {
    const map = {}
    const children = state.model?.treeData?.children || []
    for (const child of children) {
      const tradeOffs = child.logic_payload?.trade_offs || []
      const dims = {}
      for (const t of tradeOffs) {
        dims[t.dimension] = t.delta
      }
      map[child.name] = dims
    }
    return map
  }

  /**
   * 获取归因文本，基于 trade_offs 和当前权重。
   * 按实际 impact = (paramValue/100 - 0.5) × delta × 2 排序，
   * 找到对分数变化贡献最大的维度，生成一致的归因文案。
   */
  function getScoreAttribution(optionName) {
    if (!state.model) return ''
    const baseScore = state.model.scores?.[optionName] ?? 50
    const adj = scores.value[optionName] ?? baseScore
    const diff = Math.round((adj - baseScore) * 100) / 100
    if (Math.abs(diff) <= 5) return ''

    const sensitivityMap = buildSensitivityMap()
    const dims = sensitivityMap[optionName] || {}

    let topDim = '', topDelta = 0, topParamValue = 50, topImpact = 0
    for (const [dim, d] of Object.entries(dims)) {
      if (state.model.weights[dim] === undefined) continue
      const pv = state.paramValues[dim] ?? 50
      const weight = state.model.weights[dim] ?? 1
      let impact
      if (state.snapshotWeights && state.snapshotWeights[dim] !== undefined) {
        impact = (pv - state.snapshotWeights[dim]) / 100 * d * 2 * weight
      } else {
        impact = (pv / 100 - 0.5) * d * 2 * weight
      }
      if (Math.abs(impact) > Math.abs(topImpact)) {
        topImpact = impact
        topDelta = d
        topDim = dim
        topParamValue = pv
      }
    }
    if (!topDim) return `与基准差异较大（${diff > 0 ? '+' : ''}${diff}分）`

    const userPrefersHigh = topParamValue > 50
    const isStrongPositive = topDelta < 0
    const sign = diff > 0 ? '+' : '-'
    const absDiff = Math.abs(diff)
    const deltaDesc = Math.abs(topDelta) > 15 ? '突出' : '一般'

    if (userPrefersHigh && isStrongPositive) {
      return `基准 ${baseScore}，重视「${topDim}」，该方案在此项${deltaDesc}，${sign}${absDiff}分`
    }
    if (userPrefersHigh && !isStrongPositive) {
      return `基准 ${baseScore}，重视「${topDim}」，该方案在此项${deltaDesc}，${sign}${absDiff}分`
    }
    if (!userPrefersHigh && isStrongPositive) {
      return `基准 ${baseScore}，淡化「${topDim}」，该方案此项优势未受关注，${sign}${absDiff}分`
    }
    return `基准 ${baseScore}，淡化「${topDim}」，该方案在此项${deltaDesc}，${sign}${absDiff}分`
  }

  const scores = computed(() => {
    if (!state.model) return {}
    const baseScores = state.model.scores
    if (!state.paramValues || !Object.keys(state.paramValues).length) return baseScores

    // 差异化敏感度公式
    const sensitivityMap = buildSensitivityMap()

    const adjusted = {}
    for (const option of state.model.options) {
      const base = baseScores[option] ?? 50
      const dims = sensitivityMap[option] || {}

      let shift = new Decimal(0)
      for (const [paramName, paramValue] of Object.entries(state.paramValues)) {
        if (state.model.weights[paramName] !== undefined && typeof paramValue === 'number') {
          const delta = dims[paramName] ?? 0
          const weight = state.model.weights[paramName] ?? 1
          // 公式：有快照时用增量 (currentValue - snapshotValue) / 100 × delta × 2 × weight
          // 否则用默认基准 (paramValue/100 - 0.5) × delta × 2 × weight
          let offset
          if (state.snapshotWeights && state.snapshotWeights[paramName] !== undefined) {
            offset = new Decimal(paramValue).sub(state.snapshotWeights[paramName]).div(100).mul(delta).mul(2).mul(weight)
          } else {
            const pv = new Decimal(paramValue).div(100)
            const half = new Decimal(0.5)
            offset = pv.sub(half).mul(delta).mul(2).mul(weight)
          }
          shift = shift.add(offset)
        }
      }

      adjusted[option] = Math.max(0, Math.min(100, Math.round(base + shift.toNumber())))
    }
    return adjusted
  })

  // Previous scores snapshot for diff comparison
  const previousScores = reactive({})
  const counterfactualActive = ref(false)
  const activeCounterfactual = ref(null)

  /** 从流水线结果中提取 4 阶段 DEVIL 输出 */
  const pipelineDevil = computed(() => {
    const steps = state.pipelineResult
    if (!steps) return null
    const keys = ['devil-framework', 'devil-model', 'devil-simulate', 'devil-nexus']
    const result = {}
    for (const key of keys) {
      if (steps[key]) result[key] = steps[key]
    }
    return Object.keys(result).length > 0 ? result : null
  })

  /** 从流水线结果中提取 NEXUS 综合报告 */
  const pipelineNexus = computed(() => {
    return state.pipelineResult?.nexus || null
  })

  // Recalculate path probabilities based on current param values.
  // Base computation mirrors adaptTree: cumulative product of event probabilities.
  // Then apply a param-alignment scaling: for each event, compare user param values
  // to the event's impact values. Closer alignment → higher probability.
  function recalcProbabilities() {
    if (!state.model || !state.model.paths) return
    const paths = state.model.paths

    for (const path of paths) {
      // Step 1: Compute base cumulative probability (same as adaptTree)
      let cumulative = new Decimal(1)
      if (path.timeline) {
        for (const evt of path.timeline) {
          cumulative = cumulative.mul(evt.probability ?? 1.0)
        }
      }

      // Step 2: Apply param-alignment scaling
      // Only if user has deviated from defaults (all params at 50 = no change)
      let hasDeviation = false
      if (state.paramValues) {
        for (const v of Object.values(state.paramValues)) {
          if (typeof v === 'number' && v !== 50) { hasDeviation = true; break }
        }
      }

      if (hasDeviation && path.timeline) {
        for (const evt of path.timeline) {
          if (evt.impact && state.paramValues) {
            let alignment = new Decimal(0)
            let count = 0
            for (const [dim, impactVal] of Object.entries(evt.impact)) {
              const userVal = state.paramValues[dim]
              if (userVal !== undefined && typeof userVal === 'number') {
                // alignment = 1 - |userVal - impactVal| / 100
                // 1.0 = perfect match, 0.0 = completely opposite.
                // impactVal is a delta (e.g. -20..+30); map to preference space [0,100] via baseline=50.
                alignment = alignment.add(1 - Math.abs(userVal - (50 + impactVal)) / 100)
                count++
              }
            }
            if (count > 0) {
              const avgAlignment = alignment.div(count).toNumber()
              // Map [0, 1] alignment to [0.7, 1.3] scale
              const scale = 0.7 + avgAlignment * 0.6
              cumulative = cumulative.mul(scale)
            }
          }
        }
      }

      const newVal = Math.max(0.01, Math.min(0.99, cumulative.toDecimalPlaces(2).toNumber()))
      state.adjustedProbabilities[path.id] = newVal
    }

    // Step 3: Normalize probabilities so sum ≈ 1.0
    const total = Object.values(state.adjustedProbabilities).reduce((a, b) => a + b, 0)
    if (total > 0) {
      for (const pathId of Object.keys(state.adjustedProbabilities)) {
        state.adjustedProbabilities[pathId] = Math.round((state.adjustedProbabilities[pathId] / total) * 100) / 100
      }
    } else {
      // Fallback: uniform distribution when all probabilities are 0
      const uniform = Math.round((1.0 / paths.length) * 100) / 100
      for (const path of paths) {
        state.adjustedProbabilities[path.id] = uniform
      }
    }
  }

  // Counterfactual scenarios (dynamically generated from model variables)
  function buildCounterfactuals() {
    if (!state.model?.variables) return []
    const variables = state.model.variables
    const sliderVars = variables.filter(v => v.type === 'slider').map(v => v.name)

    if (!sliderVars.length) return []

    console.log('[Counterfactual] 动态生成场景，变量:', sliderVars)
    return [
      {
        key: 'optimistic',
        label: '如果更看重成长？',
        paramValues: Object.fromEntries(variables.map(v => {
          if (v.type === 'slider') return [v.name, 80]
          const opts = v.options || []
          return [v.name, opts[opts.length - 1] || opts[0] || '激进']
        })),
      },
      {
        key: 'stability',
        label: '如果更看重稳定？',
        paramValues: Object.fromEntries(variables.map(v => {
          if (v.type === 'slider') return [v.name, 20]
          const opts = v.options || []
          return [v.name, opts[0] || '保守']
        })),
      },
      {
        key: 'balance',
        label: '如果更看重平衡？',
        paramValues: Object.fromEntries(variables.map(v => {
          if (v.type === 'slider') return [v.name, 50]
          const opts = v.options || []
          return [v.name, opts[1] ?? opts[0] ?? '均衡']
        })),
      },
    ]
  }

  const counterfactuals = computed(() => buildCounterfactuals())

  function saveCurrentScores() {
    const current = scores.value
    for (const key of Object.keys(current)) {
      previousScores[key] = current[key]
    }
  }

  function applyCounterfactual(scenario) {
    saveCurrentScores()
    state.paramValues = { ...scenario.paramValues }
    counterfactualActive.value = true
    activeCounterfactual.value = scenario.key
    recalcProbabilities()
  }

  function resetCounterfactual() {
    counterfactualActive.value = false
    activeCounterfactual.value = null
    state.snapshotWeights = null
    // Reset to defaults
    if (state.model) {
      for (const v of state.model.variables) {
        if (v.type === 'select') {
          state.paramValues[v.name] = v.options?.[1] ?? v.options?.[0] ?? '均衡'
        } else {
          state.paramValues[v.name] = 50
        }
      }
    }
    recalcProbabilities()
  }

  function getScoreDiff(option) {
    if (!counterfactualActive.value || !previousScores[option]) return null
    const current = scores.value[option] ?? previousScores[option]
    const diff = current - (previousScores[option] ?? current)
    return { before: previousScores[option], after: current, diff }
  }

  async function buildModel(riskPreference) {
    if (!state.userInput.trim()) return
    // 前端基础校验
    const trimmed = state.userInput.trim()
    if (trimmed.length < 5) {
      ElMessage.warning('请输入至少5个字符的决策问题')
      return
    }
    if (!/[^\x00-\x7f]/.test(trimmed)) {
      ElMessage.warning('请包含至少一个中文字符或中文标点')
      return
    }

    state.loading = true
    // 保存问题，供深度模拟使用
    state.savedInput = state.userInput
    // 同步风险偏好到 state，供仿真引擎使用
    state.riskPreference = riskPreference
    try {
      // 先调用校验接口判断是否为有效决策问题
      const validateResult = await validateInput(state.userInput)
      if (!validateResult.valid) {
        ElMessage.warning(validateResult.reason || '请描述一个具体的决策问题')
        state.loading = false
        return
      }

      const result = await createDecisionModel(state.userInput, riskPreference)
      // 检查校验错误
      if (result?.errors) {
        const errorMessages = result.errors.map(e => e.message).join('; ')
        ElMessage.error('模型校验失败: ' + errorMessages)
        state.loading = false
        return
      }
      // 检查 LLM 是否返回无效输入错误
      if (result?.error === 'invalid_input') {
        ElMessage.warning(result.message || '请描述一个具体的决策问题')
        state.loading = false
        return
      }
      // LLM 有时返回数组，解包为单个对象
      const model = Array.isArray(result) ? result[0] : result
      // 展示 warning
      if (model.warnings && model.warnings.length > 0) {
        const warnMessages = model.warnings.map(e => e.message).join('; ')
        ElMessage.warning({ message: '模型数据存在警告: ' + warnMessages, duration: 5000 })
        delete model.warnings
      }
      // 数据清洗：结构格式化 + 语义索引
      const sanitized = sanitizeModel(model) || model
      // 通过适配器标准化 treeData
      sanitized.treeData = adaptTree(sanitized.treeData, sanitized.paths)
      state.model = sanitized
      state.paramValues = {}
      state.snapshotWeights = null
      for (const v of model.variables) {
        if (v.type === 'select') {
          state.paramValues[v.name] = v.options?.[1] ?? v.options?.[0] ?? '均衡'
        } else {
          state.paramValues[v.name] = 50
        }
      }
      state.adjustedProbabilities = {}
      // Init probabilities from mock data
      for (const path of result.paths) {
        state.adjustedProbabilities[path.id] = path.probability
      }
      // Init _version for reactivity
      state.model.treeData._version = 0
      // 默认选中根节点，展示概览视图
      state.selectedNode = null
      selectNode(state.model.treeData)
      // 模型构建完成后自动保存
      saveToStorage()
    } finally {
      state.loading = false
    }
  }

  // Throttle: batch rapid _version increments to at most once per animation frame
  let _rafPending = false
  let _versionBumpCount = 0

  function recalcScores() {
    state.paramValues = { ...state.paramValues }
    recalcProbabilities()

    _versionBumpCount++
    if (!_rafPending) {
      _rafPending = true
      requestAnimationFrame(() => {
        _rafPending = false
        if (state.model?.treeData) {
          state.model.treeData._version = (state.model.treeData._version || 0) + _versionBumpCount
          _versionBumpCount = 0
        }
      })
    }
  }

  async function runSimulation() {
    if (!state.savedInput?.trim()) return
    state.loading = true
    try {
      const result = await refineModel(state.model, state.paramValues, state.savedInput)
      // 检查校验错误
      if (result?.errors) {
        const errorMessages = result.errors.map(e => e.message).join('; ')
        ElMessage.error('模型校验失败: ' + errorMessages)
        return
      }
      // 通过适配器标准化 treeData
      // 数据清洗：结构格式化 + 语义索引
      const sanitized = sanitizeModel(result) || result
      // 展示 warning
      if (result.warnings && result.warnings.length > 0) {
        const warnMessages = result.warnings.map(e => e.message).join('; ')
        ElMessage.warning({ message: '模型数据存在警告: ' + warnMessages, duration: 5000 })
        delete result.warnings
      }
      // 通过适配器标准化 treeData
      sanitized.treeData = adaptTree(sanitized.treeData, sanitized.paths)
      state.model = sanitized
      // 记录快照，保持用户当前滑块位置
      state.snapshotWeights = { ...state.paramValues }
      state.adjustedProbabilities = {}
      for (const path of result.paths) {
        state.adjustedProbabilities[path.id] = path.probability
      }
      state.selectedNode = null
      selectNode(state.model.treeData)
      counterfactualActive.value = false
      activeCounterfactual.value = null
      // 模拟完成后自动保存
      saveToStorage()
    } finally {
      state.loading = false
    }
  }

  /**
   * 从 treeData 中按 id 精准定位节点，并返回从根到该节点的路径链。
   * 返回数组按 step 升序：[root, option, outcome, ...]
   */
  function buildPathChain(nodeId) {
    if (!state.model?.treeData || !nodeId) return []

    function findNode(node, path) {
      if (node.id === nodeId) return [...path, node]
      for (const child of (node.children || [])) {
        const result = findNode(child, [...path, node])
        if (result) return result
      }
      return null
    }

    return findNode(state.model.treeData, []) || []
  }

  /**
   * 通过 pathChain 末节点名称匹配 paths 中的 timeline
   */
  function matchPathByChain(pathChain) {
    if (!pathChain.length || !state.model?.paths) return null
    const leafName = pathChain[pathChain.length - 1].name
    return state.model.paths.find(p => p.name.includes(leafName)) || null
  }

  /**
   * 将 matchedPath 的 timeline 逻辑字段注入到 pathChain 节点中。
   * 匹配策略：语义包含 + 索引保底。
   * 注意：option 节点（idx=1）不注入 timeline，只使用自身 logic_payload。
   * 索引映射：step 2 → timeline[0]，step 3 → timeline[1]（即 idx - 2）。
   */
  function enrichPathChain(chain, matchedPath) {
    if (!matchedPath?.timeline?.length || !chain?.length) {
      console.warn('[PathTrace] enrichPathChain: 无 matchedPath 或 timeline，跳过注入')
      return chain
    }

    console.log('[PathTrace] enrichPathChain: 匹配 path', matchedPath.id, ', timeline 数量:', matchedPath.timeline.length)

    const usedIndices = new Set()

    return chain.map((node, idx) => {
      if (idx === 0) return node

      // option 节点（idx=1）不注入 timeline，只使用自身 logic_payload
      if (idx === 1) {
        console.log(`[PathTrace] Step ${node.step} "${node.name}" → option 节点，跳过 timeline 注入`)
        return {
          ...node,
          displayValue: node.score,
          logic: null,
          meta: node.logic_payload ? {
            key_impact: node.logic_payload.key_impact,
            opportunity_cost: node.logic_payload.opportunity_cost,
            trade_offs: node.logic_payload.trade_offs || [],
          } : null,
        }
      }

      // outcome 节点：按名称匹配 timeline
      let evt = null
      let matchMethod = ''

      // 1. 精确匹配
      evt = matchedPath.timeline.find(e => (e.event || '') === node.name)
      if (evt) {
        matchMethod = 'exact'
      } else {
        // 2. 语义包含匹配
        evt = matchedPath.timeline.find(e => {
          const en = e.event || ''
          return node.name.includes(en) || en.includes(node.name)
        })
        if (evt) {
          matchMethod = 'semantic'
        } else {
          // 3. 索引回退：idx - 2（step 2 → timeline[0]），且跳过已使用的
          const fallbackIdx = idx - 2
          if (fallbackIdx >= 0 && fallbackIdx < matchedPath.timeline.length && !usedIndices.has(fallbackIdx)) {
            evt = matchedPath.timeline[fallbackIdx]
            matchMethod = 'fallback'
          }
        }
      }

      if (evt) {
        const tIdx = matchedPath.timeline.indexOf(evt)
        usedIndices.add(tIdx)
        console.log(`[PathTrace] Step ${node.step} "${node.name}" → matched event: "${evt.event}" (方式: ${matchMethod})`)
      } else {
        console.warn(`[PathTrace] Step ${node.step} "${node.name}" → 无 timeline 匹配`)
      }

      return {
        ...node,
        displayValue: node.score,
        logic: evt ? {
          impact: evt.impact,
          threshold: evt.threshold,
          probability: evt.probability,
        } : null,
        meta: node.logic_payload ? {
          key_impact: node.logic_payload.key_impact,
          opportunity_cost: node.logic_payload.opportunity_cost,
          trade_offs: node.logic_payload.trade_offs || [],
        } : null,
      }
    }).map((enriched, idx) => {
      // 打印每个节点的 threshold 详情
      if (enriched.logic?.threshold) {
        console.log(`[enrichPathChain] idx=${idx} "${enriched.name}" logic.threshold:`, enriched.logic.threshold)
      } else {
        console.log(`[enrichPathChain] idx=${idx} "${enriched.name}" logic: null (无 threshold)`)
      }
      return enriched
    })
  }

  function selectNode(node) {
    const pathChain = buildPathChain(node?.id)
    console.log('[selectNode] 原始 pathChain:', pathChain.map(s => ({ name: s.name, step: s.step, threshold: s.logic?.threshold, logic_payload: s.logic_payload })))

    const matchedPath = matchPathByChain(pathChain)
    console.log('[selectNode] matchedPath:', matchedPath?.id, 'timeline:', matchedPath?.timeline)

    const enrichedChain = enrichPathChain(pathChain, matchedPath)
    console.log('[selectNode] 注入后 enrichedChain:', enrichedChain.map(s => ({ name: s.name, step: s.step, logic: s.logic, meta: s.meta })))

    const viewMode = getNodeViewMode(node, pathChain)
    state.selectedNode = node ? {
      ...node,
      pathChain: enrichedChain,
      matchedPath,
      viewMode,
    } : null
  }

  /**
   * 根据节点 children 和 step 判断应展示的视图类型。
   * 'overview' → 全局概览（根节点）
   * 'fork-compare' → 分叉对比（中间节点，有 children）
   * 'trace' → 路径溯源（叶节点，无 children）
   */
  function getNodeViewMode(node, pathChain) {
    if (!node) return 'trace'
    const hasChildren = node.children && node.children.length > 0
    // 根节点 = pathChain 长度为 1（就是自己，无父节点）
    if (pathChain.length <= 1) return 'overview'
    if (hasChildren) return 'fork-compare'
    return 'trace'
  }

  /**
   * 获取经过权重计算后的方案得分
   */
  function getAdjustedScore(optionName) {
    return scores.value[optionName] ?? 50
  }

  /**
   * 运行蒙特卡洛仿真，更新 state.model 的仿真结果。
   */
  function runDeepSimulation() {
    if (!state.model) return
    console.log('[DeepSim] 启动深度仿真，options:', state.model.options, 'variables:', state.model.variables.length)
    state.loading = true
    try {
      const result = runMCFromModel()
      state.monteCarloResult = result
      console.log('[DeepSim] 仿真完成，ranking:', result?.ranking)
      ElMessage.success('蒙特卡洛仿真完成')

      // 自动触发 DEVIL 审查
      runDevilReview()

      // 仿真完成后自动保存
      saveToStorage()
    } finally {
      state.loading = false
    }
  }

  /**
   * 调用 DEVIL 对抗性审查。
   */
  async function runDevilReview() {
    if (!state.model) return
    state.devilLoading = true
    try {
      const result = await devilReview(
        state.model,
        state.monteCarloResult
      )
      state.devilResult = result
      console.log('[Devil] 审查完成，challenges:', result?.challenges?.length, 'bias_flags:', result?.bias_flags?.length)
    } catch (err) {
      console.error('[Devil] 审查失败:', err.message)
    } finally {
      state.devilLoading = false
    }
  }

  /**
   * 从 state.model 构建仿真参数并运行蒙特卡洛。
   */
  function runMCFromModel() {
    const m = state.model
    const simSpec = {
      variables: (m.variables || []).map(v => ({
        name: v.name,
        sim_spec: v.sim_spec,
        weight: m.weights?.[v.name] || 0,
      })),
      options: (m.treeData?.children || []).map(child => ({
        name: child.name,
        base_score: child.value ?? 50,
        trade_offs: child.logic_payload?.trade_offs || [],
        risk_adjustment: child.logic_payload?.risk_adjustment || null,
      })),
      riskPreference: state.riskPreference || '均衡',
    }
    console.log('[DeepSim] simSpec 构建完成:', JSON.stringify(simSpec.variables.map(v => ({ name: v.name, type: v.sim_spec?.type }))))
    return runMC(simSpec, 5000)
  }

  /**
   * 运行蒙特卡洛仿真（对外暴露，可指定样本数）。
   */
  function runMonteCarlo(numSamples = 5000) {
    if (!state.model) return null
    const result = runMCFromModel()
    state.monteCarloResult = result
    return result
  }

  /**
   * 敏感性分析：对每个 slider 变量做 ±20% 扰动，记录排名变化。
   * 返回：{ stability, gap_pct, rank_flips: [{var, direction, from_rank, to_rank}], current_ranking }
   */
  function runSensitivity() {
    if (!state.model?.variables) return null

    console.group('[Sensitivity] ===== 开始分析 =====')
    const variables = state.model.variables.filter(v => v.type === 'slider')
    console.log('[Sensitivity] 变量:', variables.map(v => v.name))

    // Save current param values
    const savedParamValues = { ...state.paramValues }
    const options = state.model.options

    // Helper: compute ranking from current paramValues
    function getCurrentRanking() {
      const s = scores.value
      return options
        .map(name => ({ name, score: s[name] ?? 50 }))
        .sort((a, b) => b.score - a.score)
    }

    const baselineRanking = getCurrentRanking()
    console.log('[Sensitivity] 基准排名:', baselineRanking.map(r => `${r.name}(${r.score})`).join(', '))

    // Gap between 1st and 2nd
    const gapPct = baselineRanking.length >= 2
      ? Math.round(((baselineRanking[0].score - baselineRanking[1].score) / baselineRanking[0].score) * 100) / 100
      : null

    const rankFlips = []
    const flipCountByVar = {}

    for (const v of variables) {
      flipCountByVar[v.name] = 0
      const origVal = savedParamValues[v.name] ?? 50

      for (const direction of [1, -1]) {
        const perturbedVal = Math.max(0, Math.min(100, origVal + direction * 20))
        // Temporarily perturb
        state.paramValues = { ...savedParamValues, [v.name]: perturbedVal }
        // Force reactive recalc
        state.paramValues = { ...state.paramValues }

        const perturbedRanking = getCurrentRanking()
        console.log(`[Sensitivity] ${v.name} ${direction > 0 ? '+' : '-'}20% (val=${perturbedVal}):`, perturbedRanking.map(r => `${r.name}(${r.score})`).join(', '))

        // Check if ranking changed compared to baseline
        for (let i = 0; i < baselineRanking.length; i++) {
          if (perturbedRanking[i]?.name !== baselineRanking[i]?.name) {
            rankFlips.push({
              var: v.name,
              direction: direction > 0 ? '+20%' : '-20%',
              from_rank: baselineRanking.findIndex(r => r.name === perturbedRanking[i]?.name) + 1,
              to_rank: i + 1,
              option: perturbedRanking[i]?.name,
            })
            flipCountByVar[v.name]++
          }
        }
      }

      // Restore
      state.paramValues = { ...savedParamValues }
    }

    // Stability determination
    const totalPerturbations = variables.length * 2
    const totalFlips = Object.values(flipCountByVar).reduce((a, b) => a + b, 0)
    let stability
    if (totalFlips === 0) {
      stability = 'stable'
    } else if (totalFlips <= Math.floor(totalPerturbations / 4)) {
      stability = 'partially_stable'
    } else {
      stability = 'unstable'
    }

    const result = {
      stability,
      gap_pct: gapPct,
      rank_flips: rankFlips,
      flip_count_by_var: flipCountByVar,
      total_flips: totalFlips,
      total_perturbations: totalPerturbations,
      current_ranking: baselineRanking.map((r, i) => ({ ...r, rank: i + 1 })),
    }

    state.model.sensitivity = result
    console.log('[Sensitivity] 结果:', result)
    console.groupEnd()

    return result
  }

  /**
   * 运行多 Agent 流水线。
   * 使用 fetch + EventSource 风格接收 SSE 流式进度。
   * 如果传入 currentModel，则进入深度验证模式（保持 options/weights 不变）。
   */
  async function runPipeline(currentModel) {
    if (!state.userInput.trim() && !currentModel) return
    const mode = currentModel ? 'deep-validation' : 'quick-build'
    console.log('[Pipeline] 启动完整流水线', currentModel ? '(深度验证模式)' : '')
    state.loading = true
    state.pipelineStatus = 'running'
    state.pipelineCompletedSteps = []
    state.pipelineId = null
    state.pipelineMode = mode

    try {
      const response = await runFullPipeline(state.userInput, currentModel || null)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            // event type line
          } else if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim())
              if (data.pipelineId) {
                state.pipelineId = data.pipelineId
              }
              if (data.step && data.status === 'running') {
                // DEVIL steps run in background, skip visible progress
                if (data.step.startsWith('devil-')) continue
                state.pipelineCurrentStep = data.step
                console.log(`[Pipeline] Step "${data.step}" running`)
              } else if (data.step && data.status === 'completed') {
                if (data.step.startsWith('devil-')) continue
                state.pipelineCurrentStep = data.step
                state.pipelineCompletedSteps = [...state.pipelineCompletedSteps, data.step]
                console.log(`[Pipeline] Step "${data.step}" completed`)
              } else if (data.steps) {
                // Complete event
                state.pipelineStatus = 'completed'
                state.pipelineCurrentStep = null
                state.pipelineResult = data.steps
                console.log('[Pipeline] 流水线完成')

                // 提取 build-model 结果作为模型
                if (data.steps['build-model']) {
                  const model = data.steps['build-model']
                  const sanitized = sanitizeModel(model) || model
                  sanitized.treeData = adaptTree(sanitized.treeData, sanitized.paths)
                  state.model = sanitized
                  state.paramValues = {}
                  for (const v of sanitized.variables || []) {
                    if (v.type === 'select') {
                      state.paramValues[v.name] = v.options?.[1] ?? v.options?.[0] ?? '均衡'
                    } else {
                      state.paramValues[v.name] = 50
                    }
                  }
                  state.adjustedProbabilities = {}
                  for (const path of sanitized.paths || []) {
                    state.adjustedProbabilities[path.id] = path.probability
                  }
                  state.model.treeData._version = 0
                  state.selectedNode = null
                  selectNode(state.model.treeData)
                  // 流水线完成后自动触发蒙特卡洛仿真和 DEVIL 审查
                  runDeepSimulation()
                }
                ElMessage.success('多 Agent 流水线完成')
              }
            } catch { /* skip parse errors */ }
          }
        }
      }
    } catch (err) {
      console.error('[Pipeline] 流水线失败:', err.message)
      state.pipelineStatus = 'failed'
      ElMessage.error('流水线执行失败: ' + err.message)
    } finally {
      state.loading = false
    }
  }

  /**
   * 深度验证：基于已有模型，通过 5 步流水线做增强验证。
   */
  async function runDeepValidation() {
    if (!state.model) {
      ElMessage.warning('请先输入决策问题并点击快速建模')
      return
    }
    // 复用 runPipeline，传入 currentModel 触发深度验证模式
    await runPipeline(state.model)
  }

  /**
   * 更新用户风险偏好，触发仿真重新计算。
   */
  function setRiskPreference(pref) {
    state.riskPreference = pref
    // 重新运行仿真以反映新的风险偏好
    if (state.model && state.monteCarloResult) {
      runMonteCarlo()
    }
  }

  /**
   * 重新生成模型：清空当前模型数据，保留用户输入。
   */
  function resetModel() {
    state.model = null
    state.selectedNode = null
    state.monteCarloResult = null
    state.devilResult = null
    state.devilLoading = false
    state.paramValues = {}
    state.adjustedProbabilities = {}
    state.snapshotWeights = null
    state.pipelineId = null
    state.pipelineStatus = 'idle'
    state.pipelineCurrentStep = null
    state.pipelineCompletedSteps = []
    state.pipelineResult = null
    state.riskPreference = '均衡'
    counterfactualActive.value = false
    activeCounterfactual.value = null
    ElMessage.info('模型已清空，请重新输入问题并点击快速建模')
  }

  return {
    state,
    scores,
    pipelineDevil,
    pipelineNexus,
    buildModel,
    recalcScores,
    runDeepSimulation,
    runDevilReview,
    recalcProbabilities,
    selectNode,
    counterfactuals,
    counterfactualActive,
    activeCounterfactual,
    applyCounterfactual,
    resetCounterfactual,
    getScoreDiff,
    getAdjustedScore,
    getScoreAttribution,
    runMonteCarlo,
    runSensitivity,
    runPipeline,
    runDeepValidation,
    resetModel,
    clearStorage,
    setRiskPreference,
  }
}
