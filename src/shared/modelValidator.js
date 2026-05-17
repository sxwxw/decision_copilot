/**
 * 前后端共享的数据验证与清洗模块。
 * 纯 JavaScript，无框架/环境依赖。
 */

import {
  PROBABILITY_LABELS,
  DELTA_LABELS,
  numberToProbabilityLabel,
  numberToDeltaLabel,
} from './qualitativeMap.js'
import { normalizeProbabilities } from '../engines/probNormalizer.js'

/** 定性标签到数值的查表转换 */
function resolveProbabilityLabel(label) {
  if (PROBABILITY_LABELS[label]) return PROBABILITY_LABELS[label].base
  return null
}

function resolveDeltaLabel(label) {
  if (DELTA_LABELS[label]) return DELTA_LABELS[label].base
  return null
}

/** 将数值概率反向转为标签再查表，实现双轨解析 */
function dualTrackProbability(value) {
  const label = numberToProbabilityLabel(value)
  return resolveProbabilityLabel(label)
}

/** 将数值 delta 反向转为标签再查表 */
function dualTrackDelta(value) {
  const label = numberToDeltaLabel(value)
  return resolveDeltaLabel(label)
}

export function validateModel(raw) {
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
    if (Math.abs(sum - 1.0) > 0.10) {
      errors.push({ field: 'paths', message: `「${option}」路径概率总和为 ${sum.toFixed(2)}，应 ≈ 1.0`, severity: 'error' })
    } else if (Math.abs(sum - 1.0) > 0.05) {
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

  // 语义一致性：trade_offs.dimension ∈ variables
  const deltaMap = {}
  function checkTradeOffs(node, path) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node.logic_payload?.trade_offs)) {
      for (let i = 0; i < node.logic_payload.trade_offs.length; i++) {
        const dim = node.logic_payload.trade_offs[i].dimension
        if (dim && variables.length > 0 && !variables.includes(dim)) {
          errors.push({ field: `${path}.logic_payload.trade_offs[${i}].dimension`, message: `维度 "${dim}" 不在变量列表中`, severity: 'warning' })
        }
        // delta 范围校验：支持数值 delta 和 delta_label
        let delta = node.logic_payload.trade_offs[i].delta
        if (dim && typeof delta === 'undefined') {
          // 如果只有 delta_label，查表映射
          const deltaLabel = node.logic_payload.trade_offs[i].delta_label
          if (deltaLabel) {
            delta = resolveDeltaLabel(deltaLabel)
            if (delta === null) delta = 0 // 未知标签视为 0
          }
        }
        if (dim && typeof delta === 'number') {
          if (!deltaMap[dim]) deltaMap[dim] = []
          deltaMap[dim].push({ delta, optionName: node.name })
          const abs = Math.abs(delta)
          if (abs > 40) {
            errors.push({ field: `treeData.trade_offs`, message: `"${dim}" delta=${delta} 绝对值 > 40，超出合理范围`, severity: 'error' })
          } else if (abs > 20) {
            errors.push({ field: `treeData.trade_offs`, message: `"${dim}" delta=${delta} 绝对值 > 20，建议控制在范围内`, severity: 'warning' })
          }
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

  // delta 跨选项差值校验
  for (const [dim, entries] of Object.entries(deltaMap)) {
    const deltas = entries.map(e => e.delta)
    const max = Math.max(...deltas)
    const min = Math.min(...deltas)
    if (max - min > 30) {
      const involved = entries.map(e => `${e.optionName || '匿名'}(${e.delta})`).join(', ')
      errors.push({ field: 'treeData.trade_offs', message: `"${dim}" 跨选项 delta 差值 ${max - min} > 30 (${involved})，可能存在锚定偏见`, severity: 'warning' })
    }
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

  return errors
}

export function sanitizeModel(raw) {
  if (!raw || typeof raw !== 'object') return null

  const d = { ...raw }

  // 1a. options 确保为数组
  d.options = Array.isArray(d.options) ? d.options : []

  // 1b. variables 从 weights key 构造，保留 LLM 原始变量中的 sim_spec
  if (d.weights && typeof d.weights === 'object') {
    const varKeys = Object.keys(d.weights)
    const RISK_PREFERENCE = '风险偏好'
    const otherKeys = varKeys.filter(k => k !== RISK_PREFERENCE)
    const originalVarMap = Array.isArray(raw.variables)
      ? Object.fromEntries(raw.variables.map(v => [v.name, v]))
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

  // 1c. weights key ⊆ variables.name，并做刚性归一化
  const validVarNames = new Set(d.variables.map(v => v.name))
  d.weights = d.weights && typeof d.weights === 'object'
    ? Object.fromEntries(Object.entries(d.weights).filter(([k]) => validVarNames.has(k)))
    : {}
  // 权重归一化：确保总和精确为 1.0
  const weightKeys = Object.keys(d.weights)
  if (weightKeys.length > 0) {
    const weightVals = weightKeys.map(k => d.weights[k])
    const normalized = normalizeProbabilities(weightVals)
    const wSum = normalized.reduce((a, b) => a + b, 0)
    if (wSum > 0) {
      weightKeys.forEach((k, i) => {
        d.weights[k] = Math.round((normalized[i] / wSum) * 1000) / 1000
      })
    }
  }

  // 1d. scores key ⊆ options
  const validOptions = new Set(d.options)
  d.scores = d.scores && typeof d.scores === 'object'
    ? Object.fromEntries(Object.entries(d.scores).filter(([k]) => validOptions.has(k)))
    : {}
  for (const opt of d.options) {
    if (d.scores[opt] === undefined) d.scores[opt] = 50
  }

  // 1e. trade_offs.dimension ⊆ variables.name
  function sanitizeTradeOffs(node) {
    if (node.logic_payload?.trade_offs) {
      node.logic_payload.trade_offs = node.logic_payload.trade_offs
        .filter(t => validVarNames.has(t.dimension))
    }
    if (node.children) {
      for (const child of node.children) sanitizeTradeOffs(child)
    }
  }
  if (d.treeData) sanitizeTradeOffs(d.treeData)

  // 1f. paths[].impact.key ⊆ variables.name
  if (Array.isArray(d.paths)) {
    for (const path of d.paths) {
      if (path.timeline) {
        for (const evt of path.timeline) {
          if (evt.impact) {
            evt.impact = Object.fromEntries(Object.entries(evt.impact).filter(([k]) => validVarNames.has(k)))
          }
          if (evt.threshold) {
            evt.threshold = Object.fromEntries(Object.entries(evt.threshold).filter(([k]) => validVarNames.has(k)))
          }
        }
      }
    }
  }

  // 1g. 双轨解析：定性标签映射 + LLM 数值兜底
  if (Array.isArray(d.paths)) {
    for (const path of d.paths) {
      // 如果存在 probability_label 字段，查表映射为数值
      if (path.probability_label && typeof path.probability === 'undefined') {
        const resolved = resolveProbabilityLabel(path.probability_label)
        if (resolved !== null) {
          path.probability = resolved
        }
      }
      // 如果 LLM 直接输出了数值，反向转标签再映射（双轨兜底）
      if (typeof path.probability === 'number' && !path.probability_label) {
        const mapped = dualTrackProbability(path.probability)
        if (mapped !== path.probability) {
          path.probability = mapped
        }
      }
      // treeData 节点中的 trade_offs delta 双轨处理
      if (path.timeline) {
        for (const evt of path.timeline) {
          // 概率标签映射
          if (evt.probability_label && typeof evt.probability === 'undefined') {
            const resolved = resolveProbabilityLabel(evt.probability_label)
            if (resolved !== null) evt.probability = resolved
          }
          // delta 标签映射
          if (evt.delta_label && typeof evt.delta === 'undefined') {
            const resolved = resolveDeltaLabel(evt.delta_label)
            if (resolved !== null) evt.delta = resolved
          }
        }
      }
    }
  }
  if (d.treeData && Array.isArray(d.treeData.children)) {
    function normalizeNodeDeltas(node) {
      if (node.logic_payload?.trade_offs) {
        for (const t of node.logic_payload.trade_offs) {
          if (t.delta_label && typeof t.delta === 'undefined') {
            const resolved = resolveDeltaLabel(t.delta_label)
            if (resolved !== null) t.delta = resolved
          }
          // 双轨兜底：LLM 输出数值 delta，反向转标签再映射
          if (typeof t.delta === 'number' && !t.delta_label) {
            const mapped = dualTrackDelta(t.delta)
            if (mapped !== t.delta) t.delta = mapped
          }
        }
      }
      if (node.children) {
        for (const child of node.children) normalizeNodeDeltas(child)
      }
    }
    for (const child of d.treeData.children) normalizeNodeDeltas(child)
  }

  // 1h. 概率归一化：对每个 option 下的路径概率做归一化
  if (Array.isArray(d.paths) && d.paths.length > 0) {
    const pathsByOption = {}
    for (const path of d.paths) {
      const optionName = (path.name || '').split('→')[0].trim()
      if (!optionName) continue
      if (!pathsByOption[optionName]) pathsByOption[optionName] = []
      pathsByOption[optionName].push(path)
    }
    for (const [, group] of Object.entries(pathsByOption)) {
      const rawProbs = group.map(p => p.probability ?? 0)
      const normalized = normalizeProbabilities(rawProbs)
      group.forEach((p, i) => {
        p.probability = normalized[i]
      })
    }
  }

  // 1i. 加权推导缺失维度的 trade_offs
  if (d.treeData && Array.isArray(d.paths)) {
    deriveTradeoffs(d.treeData, d.paths)
  }

  return d
}

/**
 * 从缺失的维度推导 option 级 trade_offs。
 */
function deriveTradeoffs(treeData, paths) {
  if (!treeData?.children || !paths?.length) return

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
    const l1Children = optionNode.children || []

    for (const l1 of l1Children) {
      if (!l1.logic_payload?.trade_offs) continue
      for (const t of l1.logic_payload.trade_offs) {
        if (existingDims.has(t.dimension)) continue

        const dimName = t.dimension
        let weightedSum = 0
        let probTotal = 0

        for (const child of l1Children) {
          const childTradeOffs = child.logic_payload?.trade_offs || []
          const childEntry = childTradeOffs.find(c => c.dimension === dimName)
          if (!childEntry) continue

          const prob = l1Probs[child.name]
          if (prob != null) {
            weightedSum += childEntry.delta * prob
            probTotal += prob
          }
        }

        const derivedDelta = probTotal > 0
          ? Math.round((weightedSum / probTotal) * 100) / 100
          : 0

        optionNode.logic_payload.trade_offs.push({ dimension: dimName, delta: derivedDelta })
        existingDims.add(dimName)
      }
    }
  }
}
