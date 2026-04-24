import { reactive, computed, ref } from 'vue'
import { createDecisionModel, simulateModel } from '../api/decision'
import { Decimal } from 'decimal.js'

// ── 适配器：将 LLM 输出的毛坯数据标准化为组件契约 ──
let _idCounter = 0
function genId() {
  return `n-${++_idCounter}`
}

function adaptTree(rawTree, rawPaths) {
  _idCounter = 0

  // 1) 从 paths 中构建 event→probability 映射，按路径层级累积
  const eventProbMap = {}
  if (rawPaths && rawPaths.length) {
    for (const path of rawPaths) {
      if (!path.timeline) continue
      let cumulative = new Decimal(1)
      for (const evt of path.timeline) {
        cumulative = cumulative.mul(evt.probability ?? 1.0)
        // 用事件名做 key，不再依赖 year
        if (evt.event) {
          const cVal = cumulative.toDecimalPlaces(2).toNumber()
          if (!eventProbMap[evt.event] || eventProbMap[evt.event] < cVal) {
            eventProbMap[evt.event] = cVal
          }
        }
      }
    }
  }

  // 2) 递归遍历树，标准化字段并注入 probability + pathIds
  function adaptNode(node, depth, optionName) {
    const step = depth
    const rawName = node.name ?? ''
    const cleanName = rawName.replace(/^第[0-9]+年[：:]\s*/, '')

    // 从 eventProbMap 按节点名查找概率
    let probability = eventProbMap[cleanName]
    if (probability === undefined) {
      probability = (node.value ?? 50) / 100
    }
    probability = Math.max(0, Math.min(1, parseFloat(probability.toFixed(2))))

    const adapted = {
      id: genId(),
      name: cleanName,
      step,
      score: node.value ?? 50,
      status: node.eventType || null,
      probability,
      isDashed: step >= 2,
      children: [],
      pathIds: [],
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

  // 3) 为每个节点注入经过它的 pathIds
  // 根节点始终包含所有 pathId
  if (rawPaths && rawPaths.length) {
    adapted.pathIds = rawPaths.map(p => p.id)

    // 对每个 path，按 timeline 事件名顺序在树中递归匹配，注入 pathId
    for (const path of rawPaths) {
      if (!path.timeline || !path.timeline.length) continue

      const events = path.timeline.map(evt =>
        evt.event?.replace(/^第[0-9]+年[：:]\s*/, '') || evt.event)

      function matchPath(treeNode, eventIndex) {
        if (eventIndex >= events.length) return
        const target = events[eventIndex]
        if (treeNode.name === target) {
          treeNode.pathIds.push(path.id)
          for (const child of (treeNode.children || [])) {
            matchPath(child, eventIndex + 1)
          }
        } else {
          for (const child of (treeNode.children || [])) {
            matchPath(child, eventIndex)
          }
        }
      }

      for (const child of (adapted.children || [])) {
        matchPath(child, 0)
      }
    }
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

    // 按实际 impact 排序：(paramValue/100 - 0.5) × delta × 2
    let topDim = '', topDelta = 0, topParamValue = 50, topImpact = 0
    for (const [dim, d] of Object.entries(dims)) {
      if (state.model.weights[dim] === undefined) continue
      const pv = state.paramValues[dim] ?? 50
      const impact = (pv / 100 - 0.5) * d * 2
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
          // 公式：(paramValue/100 - 0.5) × delta × 2
          const pv = new Decimal(paramValue).div(100)
          const half = new Decimal(0.5)
          const d = new Decimal(delta)
          shift = shift.add(pv.sub(half).mul(d).mul(2))
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
      // 通过适配器标准化 treeData
      model.treeData = adaptTree(model.treeData, model.paths)
      state.model = model
      state.paramValues = {}
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
      const result = await simulateModel(state.savedInput, state.paramValues)
      // 通过适配器标准化 treeData
      result.treeData = adaptTree(result.treeData, result.paths)
      state.model = result
      // 重置参数为默认值，避免与上次模拟冲突
      state.paramValues = {}
      for (const v of result.variables) {
        if (v.type === 'select') {
          state.paramValues[v.name] = v.options?.[1] ?? v.options?.[0] ?? '均衡'
        } else {
          state.paramValues[v.name] = 50
        }
      }
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

  function selectNode(node) {
    const pathChain = buildPathChain(node?.id)
    const matchedPath = matchPathByChain(pathChain)
    const viewMode = getNodeViewMode(node, pathChain)
    state.selectedNode = node ? {
      ...node,
      pathChain,
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
