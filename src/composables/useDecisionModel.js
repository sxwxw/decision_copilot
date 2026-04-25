import { reactive, computed, ref } from 'vue'
import { createDecisionModel, simulateModel, refineModel } from '../api/decision'
import { Decimal } from 'decimal.js'

// ── 数据清洗器：结构格式化 + 语义索引 ──

function sanitizeModel(rawData) {
  if (!rawData || typeof rawData !== 'object') return null

  const d = { ...rawData }

  console.group('[Sanitizer] ===== 开始清洗 =====')

  // ── Step 1: 结构格式化 ──

  // 1a. options 确保为数组
  d.options = Array.isArray(d.options) ? d.options : []
  console.log('[Sanitizer] options:', JSON.stringify(d.options))

  // 1b. variables 从 weights key 自动构造
  // LLM 不再需要返回 variables 数组，前端根据 weights key 自行补全
  if (Array.isArray(rawData.variables) && rawData.variables.length > 0) {
    d.variables = rawData.variables
  } else if (d.weights && typeof d.weights === 'object') {
    const varKeys = Object.keys(d.weights)
    const RISK_PREFERENCE = '风险偏好'
    const otherKeys = varKeys.filter(k => k !== RISK_PREFERENCE)
    d.variables = [
      ...otherKeys.map(name => ({ name, type: 'slider', range: [0, 100] })),
      { name: RISK_PREFERENCE, type: 'select', options: ['保守', '均衡', '激进'] }
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
  loading: false,
  model: null,       // { options, variables, weights, treeData, paths, recommendation, scores }
  selectedNode: null,
  paramValues: {},   // current param values for recalc
  snapshotWeights: null, // snapshot of param values at time of last refine (for incremental scoring)
  adjustedProbabilities: {}, // pathId -> adjusted probability
})

export function useDecisionModel() {
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

    // 按实际 impact 排序：有快照时用 (paramValue - snapshotValue) / 100 × delta × 2，否则用 (paramValue/100 - 0.5) × delta × 2
    let topDim = '', topDelta = 0, topParamValue = 50, topImpact = 0
    for (const [dim, d] of Object.entries(dims)) {
      if (state.model.weights[dim] === undefined) continue
      const pv = state.paramValues[dim] ?? 50
      let impact
      if (state.snapshotWeights && state.snapshotWeights[dim] !== undefined) {
        impact = (pv - state.snapshotWeights[dim]) / 100 * d * 2
      } else {
        impact = (pv / 100 - 0.5) * d * 2
      }
      if (Math.abs(impact) > Math.abs(topImpact)) {
        topImpact = impact
        topDelta = d
        topDim = dim
        topParamValue = pv
      }
    }
    if (!topDim) return `与基准差异较大（${diff > 0 ? '+' : ''}${diff}分）`

    const userValues = topParamValue > 50
    const isStrong = topDelta > 0
    const sign = diff > 0 ? '+' : '-'
    const absDiff = Math.abs(diff)

    if (userValues && isStrong) {
      return `基准 ${baseScore}，你重视「${topDim}」，该方案在此项突出，${sign}${absDiff}分`
    }
    if (userValues && !isStrong) {
      return `基准 ${baseScore}，你重视「${topDim}」，该方案在此项不足，${sign}${absDiff}分`
    }
    if (!userValues && isStrong) {
      return `基准 ${baseScore}，你淡化「${topDim}」，该方案此项优势未受关注，${sign}${absDiff}分`
    }
    return `基准 ${baseScore}，你降低「${topDim}」的短板影响，${sign}${absDiff}分`
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
          // 公式：有快照时用增量 (currentValue - snapshotValue) / 100 × delta × 2
          // 否则用默认基准 (paramValue/100 - 0.5) × delta × 2
          let offset
          if (state.snapshotWeights && state.snapshotWeights[paramName] !== undefined) {
            offset = new Decimal(paramValue).sub(state.snapshotWeights[paramName]).div(100).mul(delta).mul(2)
          } else {
            const pv = new Decimal(paramValue).div(100)
            const half = new Decimal(0.5)
            offset = pv.sub(half).mul(delta).mul(2)
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
                // 1.0 = perfect match, 0.0 = completely opposite
                alignment = alignment.add(1 - Math.abs(userVal - impactVal) / 100)
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
  }

  // Counterfactual scenarios
  const counterfactuals = [
    {
      key: 'growth',
      label: '如果更看重成长？',
      paramValues: { '收入预期': 30, '成长空间': 80, '风险指数': 60, '幸福指数': 40, '风险偏好': '激进' },
    },
    {
      key: 'stability',
      label: '如果更看重稳定？',
      paramValues: { '收入预期': 80, '成长空间': 30, '风险指数': 20, '幸福指数': 70, '风险偏好': '保守' },
    },
    {
      key: 'happiness',
      label: '如果更看重幸福？',
      paramValues: { '收入预期': 40, '成长空间': 40, '风险指数': 30, '幸福指数': 80, '风险偏好': '均衡' },
    },
  ]

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

  async function buildModel() {
    if (!state.userInput.trim()) return
    state.loading = true
    // 保存问题，供深度模拟使用
    state.savedInput = state.userInput
    try {
      const result = await createDecisionModel(state.userInput)
      // LLM 有时返回数组，解包为单个对象
      const model = Array.isArray(result) ? result[0] : result
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
      // 通过适配器标准化 treeData
      // 数据清洗：结构格式化 + 语义索引
      const sanitized = sanitizeModel(result) || result
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

  return {
    state,
    scores,
    buildModel,
    recalcScores,
    runSimulation,
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
  }
}
