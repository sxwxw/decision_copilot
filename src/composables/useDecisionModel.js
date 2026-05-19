import { reactive, computed, ref, watch } from 'vue'
import { devilReview, runFullPipeline, validateInput, correctModel as correctModelApi } from '../api/decision'
import { runMonteCarlo as runMC } from '../utils/simulator.js'
import { ElMessage } from 'element-plus'

// Infrastructure layer
import { save as saveStorage, load as loadStorage, clear as clearStorage } from '../services/storage'

// Shared layer
import { validateModel, sanitizeModel } from '../shared/modelValidator'
import { calcScoreOffset } from '../shared/scoreEngine'

// Engine layer
import { adaptTree } from '../engines/treeAdapter'
import { getScoreAttribution, getScoreDiff, topImpactDimension } from '../engines/scoreAttribution'
import { analyze as analyzeSensitivity, computeEVIU } from '../engines/sensitivityEngine'
import { PROBABILITY_LABELS } from '../shared/qualitativeMap.js'

const state = reactive({
  userInput: '',
  savedInput: '',
  riskPreference: '均衡',
  loading: false,
  model: null,
  selectedNode: null,
  paramValues: {},
  snapshotWeights: null,
  adjustedProbabilities: {},
  monteCarloResult: null,
  devilResult: null,
  devilLoading: false,
  pipelineId: null,
  pipelineStatus: 'idle',
  pipelineCurrentStep: null,
  pipelineCompletedSteps: [],
  pipelineResult: null,
  pipelineMode: 'quick-build',
  pipelineInnerLoopCount: 0,
  pipelineOuterLoopCount: 0,
  pipelineInnerLoopSkipped: false,
  pipelineOuterLoopSkipped: false,
  pipelineOuterLoopLowConfidence: false,
})

let _pipelineAbortController = null

const PHASE_MESSAGES = {
  framework: '正在构建决策框架，识别关键变量...',
  'build-model': '正在构建决策模型，评估各方案路径...',
  simulate: '正在进行蒙特卡洛模拟，计算概率分布...',
  nexus: '正在生成综合分析报告...',
  'inner-loop': '发现关键偏差，正在自我校准模型...',
  'outer-loop': '整体置信度不足，正在重塑决策框架...',
  correction: '正在根据用户偏好修正模型...',
}

/**
 * Pipeline loading composable: phase-aware typewriter effect.
 * Returns `displayMessage` ref that animates text character-by-character.
 */
function usePipelineLoading() {
  const displayMessage = ref('')
  let _timer = null
  let _fullMessage = ''

  function stop() {
    if (_timer) { clearTimeout(_timer); _timer = null }
  }

  function typeMessage(text) {
    stop()
    if (!text) { displayMessage.value = ''; return }
    _fullMessage = text
    displayMessage.value = ''
    let i = 0
    const speed = 40 + Math.random() * 30
    function tick() {
      i++
      displayMessage.value = _fullMessage.slice(0, i)
      if (i < _fullMessage.length) {
        _timer = setTimeout(tick, speed)
      } else {
        _timer = null
      }
    }
    _timer = setTimeout(tick, speed)
  }

  function setPhase(phase) {
    const msg = PHASE_MESSAGES[phase] || PHASE_MESSAGES.framework
    typeMessage(msg)
  }

  return { displayMessage, setPhase, stop }
}

// Create a single instance shared across the module
const loadingDisplay = usePipelineLoading()

// Watch pipeline step changes to trigger typewriter automatically
watch(
  () => ({
    step: state.pipelineCurrentStep,
    status: state.pipelineStatus,
  }),
  ({ step, status }) => {
    if (status === 'running' && step) {
      if (step.includes('inner-loop')) {
        loadingDisplay.setPhase('inner-loop')
      } else if (step.includes('outer-loop')) {
        loadingDisplay.setPhase('outer-loop')
      } else {
        loadingDisplay.setPhase(step)
      }
    } else if (status === 'completed') {
      loadingDisplay.stop()
    }
  },
)

/**
 * Typewriter composable: renders text with a character-by-character reveal effect.
 */
export function useTypewriter(speed = 50) {
  const displayText = ref('')
  let _timer = null
  let _fullText = ''

  function stop() {
    if (_timer) { clearTimeout(_timer); _timer = null }
  }

  function setMessage(text) {
    stop()
    if (!text) { displayText.value = ''; return }
    _fullText = text
    displayText.value = ''
    let i = 0
    function tick() {
      i++
      displayText.value = _fullText.slice(0, i)
      if (i < _fullText.length) {
        _timer = setTimeout(tick, speed)
      } else {
        _timer = null
      }
    }
    _timer = setTimeout(tick, speed)
  }

  return { displayText, setMessage, stop }
}

function saveToStorage() {
  saveStorage({
    userInput: state.userInput,
    model: state.model,
    paramValues: state.paramValues,
    adjustedProbabilities: state.adjustedProbabilities,
    riskPreference: state.riskPreference,
    pipelineResult: state.pipelineResult,
    monteCarloResult: state.monteCarloResult,
    devilResult: state.devilResult,
    pipelineId: state.pipelineId,
    pipelineStatus: state.pipelineStatus,
    pipelineCompletedSteps: state.pipelineCompletedSteps,
    pipelineMode: state.pipelineMode,
  })
}

function loadFromStorage() {
  return loadStorage()
}

function clearStorageFn() {
  clearStorage()
}

function clearAllModelingData() {
  clearStorage()
  state.userInput = ''
  state.savedInput = ''
  state.riskPreference = '均衡'
  state.loading = false
  state.model = null
  state.selectedNode = null
  state.paramValues = {}
  state.snapshotWeights = null
  state.adjustedProbabilities = {}
  state.monteCarloResult = null
  state.devilResult = null
  state.devilLoading = false
  state.pipelineId = null
  state.pipelineStatus = 'idle'
  state.pipelineCurrentStep = null
  state.pipelineCompletedSteps = []
  state.pipelineResult = null
  state.pipelineMode = 'quick-build'
  loadingDisplay.stop()
  state.pipelineInnerLoopCount = 0
  state.pipelineOuterLoopCount = 0
  state.pipelineInnerLoopSkipped = false
  state.pipelineOuterLoopSkipped = false
  state.pipelineOuterLoopLowConfidence = false
  _pipelineAbortController = null
}

export function useDecisionModel() {
  function tryRestoreFromStorage() {
    const data = loadFromStorage()
    if (!data) {
      // localStorage 无缓存时，清空内存中的 state（避免 SPA 路由切换残留旧数据）
      state.userInput = ''
      state.savedInput = ''
      state.riskPreference = '均衡'
      state.loading = false
      state.model = null
      state.selectedNode = null
      state.paramValues = {}
      state.snapshotWeights = null
      state.adjustedProbabilities = {}
      state.monteCarloResult = null
      state.devilResult = null
      state.devilLoading = false
      state.pipelineId = null
      state.pipelineStatus = 'idle'
      state.pipelineCurrentStep = null
      state.pipelineCompletedSteps = []
      state.pipelineResult = null
      state.pipelineMode = 'quick-build'
      loadingDisplay.stop()
      state.pipelineInnerLoopCount = 0
      state.pipelineOuterLoopCount = 0
      state.pipelineInnerLoopSkipped = false
      state.pipelineOuterLoopSkipped = false
      state.pipelineOuterLoopLowConfidence = false
      return
    }

    console.log('[Persistence] 恢复本地缓存模型')
    state.userInput = data.userInput || ''
    state.savedInput = data.userInput || ''
    state.riskPreference = data.riskPreference || '均衡'
    state.model = data.model
    state.paramValues = data.paramValues || {}
    state.adjustedProbabilities = data.adjustedProbabilities || {}
    state.pipelineResult = data.pipelineResult || null
    state.monteCarloResult = data.monteCarloResult || null
    state.devilResult = data.devilResult || null
    state.pipelineId = data.pipelineId || null
    state.pipelineStatus = data.pipelineStatus || 'idle'
    state.pipelineCompletedSteps = data.pipelineCompletedSteps || []
    state.pipelineMode = data.pipelineMode || 'quick-build'
    state.pipelineInnerLoopCount = 0
    state.pipelineOuterLoopCount = 0
    state.pipelineInnerLoopSkipped = false
    state.pipelineOuterLoopSkipped = false
    state.pipelineOuterLoopLowConfidence = false

    if (state.model?.treeData) {
      const hasPathRefs = state.model.treeData.pathIds && state.model.treeData.pathIds.length > 0
      if (!hasPathRefs && state.model.paths) {
        const options = state.model.options || []
        state.model.treeData.children = state.model.treeData.children.map(child => {
          const matchedOpt = options.find(o => o === child.name || child.name.includes(o))
          if (matchedOpt && child.name !== matchedOpt) {
            child.name = matchedOpt
          }
          return child
        })
        state.model.treeData = adaptTree(state.model.treeData, state.model.paths)
      }
      state.model.treeData._version = 0
    }

    state.selectedNode = null
    selectNode(state.model.treeData)
    ElMessage.success('已恢复上次决策模型')
  }

  tryRestoreFromStorage()

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

  const scores = computed(() => {
    if (!state.model) return {}
    const baseScores = state.model.scores
    if (!state.paramValues || !Object.keys(state.paramValues).length) return baseScores

    const sensitivityMap = buildSensitivityMap()
    const adjusted = {}
    for (const option of state.model.options) {
      const base = baseScores[option] ?? 50
      const dims = sensitivityMap[option] || {}

      let shift = 0
      for (const [paramName, paramValue] of Object.entries(state.paramValues)) {
        if (state.model.weights[paramName] !== undefined && typeof paramValue === 'number') {
          const delta = dims[paramName] ?? 0
          const weight = state.model.weights[paramName] ?? 1
          let offset
          if (state.snapshotWeights && state.snapshotWeights[paramName] !== undefined) {
            offset = calcScoreOffset(paramValue - state.snapshotWeights[paramName], delta, 0, weight)
          } else {
            offset = calcScoreOffset(paramValue, delta, 50, weight)
          }
          shift += offset
        }
      }

      adjusted[option] = Math.max(0, Math.min(100, Math.round(base + shift)))
    }
    return adjusted
  })

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

  const pipelineNexus = computed(() => {
    return state.pipelineResult?.nexus || null
  })

  function recalcProbabilities() {
    // DEPRECATED: 概率由 LLM 评估确定，不再随用户调参重算
  }

  function getScoreAttributionFn(optionName) {
    const sensitivityMap = buildSensitivityMap()
    return getScoreAttribution(
      optionName,
      scores.value,
      state.model?.scores,
      state.paramValues,
      state.model?.weights,
      sensitivityMap,
      state.snapshotWeights,
    )
  }

  function getScoreDiffFn(option) {
    return getScoreDiff(option, scores.value, {})
  }

  function topImpactDimensionFn(optionName) {
    const sensitivityMap = buildSensitivityMap()
    return topImpactDimension(optionName, sensitivityMap, state.paramValues, state.model?.weights)
  }

  let _rafPending = false
  let _versionBumpCount = 0

  function recalcScores() {
    state.paramValues = { ...state.paramValues }

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

  function matchPathByChain(pathChain) {
    if (!pathChain.length || !state.model?.paths) return null
    const leafName = pathChain[pathChain.length - 1].name
    for (const p of state.model.paths) {
      // 将路径名按 → 分段，取末段与叶子名做模糊匹配
      const segments = (p.name || '').split('→').map(s => s.trim())
      const leafSeg = segments[segments.length - 1]
      if (leafSeg && (leafName.includes(leafSeg) || leafSeg.includes(leafName))) return p
      // 兜底：对比 timeline 末段事件名
      const lastEvt = p.timeline?.[p.timeline.length - 1]
      if (lastEvt?.event && (leafName.includes(lastEvt.event) || lastEvt.event.includes(leafName))) return p
    }
    return null
  }

  function editDistance(a, b) {
    const m = a.length
    const n = b.length
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
      }
    }
    return dp[m][n]
  }

  function similarity(a, b) {
    if (!a && !b) return 1
    if (!a || !b) return 0
    const maxLen = Math.max(a.length, b.length)
    return 1 - editDistance(a, b) / maxLen
  }

  function enrichPathChain(chain, matchedPath) {
    if (!matchedPath?.timeline?.length || !chain?.length) {
      return chain
    }

    const usedIndices = new Set()

    return chain.map((node, idx) => {
      if (idx === 0) return node

      if (idx === 1) {
        return {
          ...node,
          displayValue: node.score,
          logic: null,
          pathIds: node.pathIds || [],
          meta: node.logic_payload ? {
            key_impact: node.logic_payload.key_impact,
            opportunity_cost: node.logic_payload.opportunity_cost,
            trade_offs: node.logic_payload.trade_offs || [],
          } : null,
        }
      }

      let evt = matchedPath.timeline.find(e => (e.event || '') === node.name)
      if (!evt) {
        let bestScore = 0
        let bestEvt = null
        for (const entry of matchedPath.timeline) {
          const en = entry.event || ''
          const s = similarity(node.name, en)
          if (s > bestScore) {
            bestScore = s
            bestEvt = entry
          }
        }
        if (bestScore >= 0.6) {
          evt = bestEvt
        }
      }
      if (!evt) {
        evt = matchedPath.timeline.find(e => {
          const en = e.event || ''
          return node.name.includes(en) || en.includes(node.name)
        })
      }

      if (evt) {
        usedIndices.add(matchedPath.timeline.indexOf(evt))
      }

      return {
        ...node,
        displayValue: node.score,
        pathIds: node.pathIds || [],
        logic: evt ? {
          impact: evt.impact,
          threshold: evt.threshold,
          probability: evt.probability ?? PROBABILITY_LABELS[evt.probability_label]?.base ?? null,
        } : null,
        meta: node.logic_payload ? {
          key_impact: node.logic_payload.key_impact,
          opportunity_cost: node.logic_payload.opportunity_cost,
          trade_offs: node.logic_payload.trade_offs || [],
        } : null,
      }
    })
  }

  function selectNode(node) {
    const pathChain = buildPathChain(node?.id)
    const matchedPath = matchPathByChain(pathChain)
    const enrichedChain = enrichPathChain(pathChain, matchedPath)
    const viewMode = getNodeViewMode(node, pathChain)
    state.selectedNode = node ? {
      ...node,
      pathChain: enrichedChain,
      matchedPath,
      viewMode,
    } : null
  }

  function getNodeViewMode(node, pathChain) {
    if (!node) return 'trace'
    const hasChildren = node.children && node.children.length > 0
    if (pathChain.length <= 1) return 'overview'
    if (hasChildren) return 'fork-compare'
    return 'trace'
  }

  function getAdjustedScore(optionName) {
    return scores.value[optionName] ?? 50
  }

  function runMonteCarlo(numSamples = 5000) {
    if (!state.model) return null
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
    const result = runMC(simSpec, numSamples)
    state.monteCarloResult = result
    return result
  }

  function runSensitivity() {
    if (!state.model?.variables) return null
    const result = analyzeSensitivity(state.model, state.paramValues, (pv) => {
      const saved = { ...state.paramValues }
      Object.assign(state.paramValues, pv)
      const s = { ...scores.value }
      Object.assign(state.paramValues, saved)
      return s
    })
    state.model.sensitivity = result
    return result
  }

  function runEVIU() {
    if (!state.model || !state.monteCarloResult) return null
    return computeEVIU(state.model, state.monteCarloResult)
  }

  async function runPipeline(currentModel) {
    if (!state.userInput.trim() && !currentModel) return

    if (_pipelineAbortController) {
      _pipelineAbortController.abort()
    }
    _pipelineAbortController = new AbortController()

    const mode = currentModel ? 'deep-validation' : 'quick-build'
    console.log('[Pipeline] 启动完整流水线', currentModel ? '(深度验证模式)' : '')
    state.loading = true
    state.pipelineStatus = 'running'
    state.pipelineCompletedSteps = []
    state.pipelineId = null
    state.pipelineMode = mode

    if (!currentModel) {
      try {
        const validateResult = await validateInput(state.userInput)
        if (!validateResult.valid) {
          ElMessage.warning(validateResult.reason || '请描述一个具体的决策问题')
          state.pipelineStatus = 'idle'
          state.loading = false
          _pipelineAbortController = null
          return
        }
      } catch {
        // Validation unavailable, proceed
      }
    }

    try {
      const response = await runFullPipeline(state.userInput, currentModel || null, state.riskPreference, {
        signal: _pipelineAbortController.signal,
      })
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
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim())
              if (data.pipelineId) {
                state.pipelineId = data.pipelineId
              }
              // Inner/outer loop triggers typewriter phases
              if (data.status === 'inner-loop-running') {
                loadingDisplay.setPhase('inner-loop')
              } else if (data.status === 'outer-loop-running') {
                loadingDisplay.setPhase('outer-loop')
              } else if (data.step && data.status === 'running') {
                if (data.step.startsWith('devil-')) continue
                state.pipelineCurrentStep = data.step
                if (data.step.includes('(v2)')) {
                  loadingDisplay.setPhase('build-model')
                }
              } else if (data.step && data.status === 'completed') {
                if (data.step.startsWith('devil-')) continue
                state.pipelineCurrentStep = data.step
                state.pipelineCompletedSteps = [...state.pipelineCompletedSteps, data.step]
              } else if (data.steps) {
                state.pipelineStatus = 'completed'
                state.pipelineCurrentStep = null
                state.pipelineResult = data.steps
                state.pipelineInnerLoopCount = data.steps.innerLoopCount || 0
                state.pipelineOuterLoopCount = data.steps.outerLoopCount || 0
                state.pipelineInnerLoopSkipped = !!data.steps.innerLoopSkipped
                state.pipelineOuterLoopSkipped = !!data.steps.outerLoopSkipped
                state.pipelineOuterLoopLowConfidence = !!data.steps.outerLoopLowConfidence

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
                  state.monteCarloResult = data.steps.simulate || null
                  saveToStorage()
                }
                if (data.steps['corrected-model']) {
                  const corrected = sanitizeModel(data.steps['corrected-model']) || data.steps['corrected-model']
                  corrected.treeData = adaptTree(corrected.treeData, corrected.paths)
                  state.model = corrected
                  state.paramValues = {}
                  for (const v of corrected.variables || []) {
                    if (v.type === 'select') {
                      state.paramValues[v.name] = v.options?.[1] ?? v.options?.[0] ?? '均衡'
                    } else {
                      state.paramValues[v.name] = 50
                    }
                  }
                  state.adjustedProbabilities = {}
                  for (const path of corrected.paths || []) {
                    state.adjustedProbabilities[path.id] = path.probability
                  }
                  state.model.treeData._version = 0
                  state.selectedNode = null
                  selectNode(state.model.treeData)
                  state.monteCarloResult = data.steps.simulate || null
                  saveToStorage()
                }
                ElMessage.success('多 Agent 流水线完成')
              }
            } catch { /* skip parse errors */ }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return
      }
      console.error('[Pipeline] 流水线失败:', err.message)
      state.pipelineStatus = 'failed'
      ElMessage.error('流水线执行失败: ' + err.message)
    } finally {
      state.loading = false
      _pipelineAbortController = null
    }
  }

  async function runDevilReview() {
    if (!state.model) return
    state.devilLoading = true
    try {
      const result = await devilReview(state.model, state.monteCarloResult)
      state.devilResult = result
    } catch (err) {
      console.error('[Devil] 审查失败:', err.message)
    } finally {
      state.devilLoading = false
    }
  }

  async function runModelCorrection() {
    if (!state.pipelineId) {
      ElMessage.warning('请先完成管线推演')
      return
    }
    const currentParams = { ...state.paramValues }

    state.loading = true
    loadingDisplay.setPhase('correction')
    try {
      const data = await correctModelApi(state.pipelineId, state.paramValues)
      if (data.errors) {
        ElMessage.error('修正失败：' + data.errors.map(e => e.message).join(', '))
        return
      }
      const corrected = sanitizeModel(data.result) || data.result
      corrected.treeData = adaptTree(corrected.treeData, corrected.paths)
      state.model = corrected
      state.adjustedProbabilities = {}
      for (const path of corrected.paths || []) {
        state.adjustedProbabilities[path.id] = path.probability
      }
      state.model.treeData._version = 0
      state.selectedNode = null
      selectNode(state.model.treeData)
      saveToStorage()
      ElMessage.success('模型已修正')
    } catch (err) {
      console.error('[Correction] 模型修正失败:', err.message)
      ElMessage.error('修正失败: ' + err.message)
    } finally {
      state.loading = false
    }
  }

  function setRiskPreference(pref) {
    state.riskPreference = pref
    if (state.model && state.monteCarloResult) {
      runMonteCarlo()
    }
  }

  async function loadDemoData(demoData) {
    // 清除可能残留的缓存，避免 tryRestoreFromStorage 干扰
    clearStorage()
    state.userInput = ''
    state.savedInput = ''
    state.model = null
    state.selectedNode = null
    state.paramValues = {}
    state.adjustedProbabilities = {}
    state.monteCarloResult = null
    state.devilResult = null
    state.pipelineResult = null
    state.pipelineStatus = 'idle'
    state.pipelineCurrentStep = null
    state.pipelineCompletedSteps = []
    state.pipelineMode = 'quick-build'
    loadingDisplay.stop()

    // Demo data is nested under 'build-model' key
    const modelData = demoData['build-model'] || demoData
    const sanitized = sanitizeModel(modelData) || modelData
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
    state.monteCarloResult = demoData.simulate || null
    state.devilResult = {
      framework: demoData['devil-framework'],
      model: demoData['devil-model'],
      simulate: demoData['devil-simulate'],
      nexus: demoData['devil-nexus'],
    }
    state.pipelineResult = {
      'build-model': demoData['build-model'],
      simulate: demoData.simulate,
      nexus: demoData.nexus,
    }
    state.userInput = demoData.framework?.decision_context || ''
    state.savedInput = demoData.framework?.decision_context || ''
    state.pipelineStatus = 'completed'
    state.pipelineMode = 'quick-build'
    saveToStorage()
  }

  async function loadMockData(mockData) {
    // 清除可能残留的缓存
    clearStorage()
    state.userInput = ''
    state.savedInput = ''
    state.model = null
    state.selectedNode = null
    state.paramValues = {}
    state.adjustedProbabilities = {}
    state.monteCarloResult = null
    state.devilResult = null
    state.pipelineResult = null
    state.pipelineStatus = 'idle'
    state.pipelineCurrentStep = null
    state.pipelineCompletedSteps = []
    state.pipelineMode = 'quick-build'
    loadingDisplay.stop()

    const modelData = mockData.model
    const sanitized = sanitizeModel(modelData) || modelData
    sanitized.treeData = adaptTree(sanitized.treeData, sanitized.paths)
    state.model = sanitized
    state.paramValues = mockData.paramValues || {}
    state.adjustedProbabilities = mockData.adjustedProbabilities || {}
    for (const path of sanitized.paths || []) {
      if (state.adjustedProbabilities[path.id] == null) {
        state.adjustedProbabilities[path.id] = path.probability
      }
    }
    state.model.treeData._version = 0
    state.selectedNode = null
    selectNode(state.model.treeData)
    state.userInput = mockData.userInput || ''
    state.savedInput = mockData.userInput || ''
    state.riskPreference = mockData.riskPreference || '均衡'
    state.monteCarloResult = mockData.monteCarloResult || null
    state.devilResult = mockData.devilResult || null
    state.pipelineResult = mockData.pipelineResult || null
    state.pipelineStatus = mockData.pipelineStatus || 'completed'
    state.pipelineMode = mockData.pipelineMode || 'quick-build'
    state.pipelineCompletedSteps = mockData.pipelineCompletedSteps || []
    state.pipelineId = mockData.pipelineId || null
    saveToStorage()
  }

  return {
    state,
    scores,
    pipelineDevil,
    pipelineNexus,
    loadingDisplay,
    recalcScores,
    runDevilReview,
    recalcProbabilities,
    selectNode,
    getAdjustedScore,
    getScoreAttribution: getScoreAttributionFn,
    getScoreDiff: getScoreDiffFn,
    topImpactDimension: topImpactDimensionFn,
    runMonteCarlo,
    runSensitivity,
    runEVIU,
    runPipeline,
    runModelCorrection,
    clearStorage: clearAllModelingData,
    setRiskPreference,
    loadDemoData,
    loadMockData,
    validateModel,
    sanitizeModel,
    adaptTree,
  }
}
