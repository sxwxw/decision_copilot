/**
 * SEE Parser — 将 SEE 子管线的 Markdown DSL 中间格式转换为目标 JSON Schema。
 * 纯 JavaScript，无框架依赖。
 */

import { PROBABILITY_LABELS, DELTA_LABELS } from '../../src/shared/qualitativeMap.js'

const VALID_PROBABILITY_LABELS = Object.keys(PROBABILITY_LABELS)
const VALID_DELTA_LABELS = Object.keys(DELTA_LABELS)

// ── Step 1 Parser ──

export function parseVariables(rawText) {
  const variables = []
  const weights = {}

  const block = extractBlock(rawText, 'VARIABLES_START', 'VARIABLES_END')
  if (!block) return { variables, weights }

  const lines = block.split('\n').map(l => l.replace(/^\s+/, ''))
  let currentVar = null

  for (const line of lines) {
    const varMatch = line.match(/^- Variable:\s*(.+)/)
    if (varMatch) {
      if (currentVar) variables.push(currentVar)
      currentVar = { name: varMatch[1].trim() }
      continue
    }
    if (!currentVar) continue

    const typeMatch = line.match(/^\*\s*Type:\s*(.+)/)
    const rangeMatch = line.match(/^\*\s*Range:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/)
    const weightMatch = line.match(/^\*\s*Weight:\s*([\d.]+)/)
    const specTypeMatch = line.match(/^\*\s*SimSpecType:\s*(.+)/)
    const specParamsMatch = line.match(/^\*\s*SimSpecParams:\s*(.+)/)

    if (typeMatch) currentVar.type = typeMatch[1].trim()
    if (rangeMatch) currentVar.range = [parseInt(rangeMatch[1]), parseInt(rangeMatch[2])]
    if (weightMatch) {
      const w = parseFloat(weightMatch[1])
      weights[currentVar.name] = w
    }
    if (specTypeMatch) {
      const st = specTypeMatch[1].trim()
      currentVar.sim_spec = { type: st, params: {} }
    }
    if (specParamsMatch) {
      const params = parseKeyValuePairs(specParamsMatch[1])
      if (currentVar.sim_spec) currentVar.sim_spec.params = params
    }
  }
  if (currentVar) variables.push(currentVar)

  // 容错：确保 type/range 有默认值
  for (const v of variables) {
    if (!v.type) v.type = 'slider'
    if (!v.range) v.range = [0, 100]
    if (!v.sim_spec) v.sim_spec = { type: 'normal', params: { mean: 50, sd: 15 } }
  }

  return { variables, weights }
}

// ── Step 2 Parser ──

export function parseCausalTree(rawText) {
  const lines = rawText.split('\n')
  let treeData = null
  const stack = [] // [{ indent, node }]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim() || line.trim() === '') continue

    // Detect [PAYLOAD] blocks
    if (line.includes('[PAYLOAD]')) {
      const payloadLines = []
      let j = i + 1
      while (j < lines.length && !lines[j].includes('[END_PAYLOAD]')) {
        const pl = lines[j].trim()
        if (pl) payloadLines.push(pl)
        j++
      }
      const payload = parsePayload(payloadLines)
      // Attach to the most recent node in stack
      if (stack.length > 0) {
        const top = stack[stack.length - 1]
        top.node.logic_payload = payload
      }
      i = j
      continue
    }

    const indent = (line.match(/^(\s*)/) || ['', ''])[1].length
    const content = line.trim()

    // Root node
    const rootMatch = content.match(/^- Root:\s*(.+)/)
    if (rootMatch) {
      treeData = { name: rootMatch[1].trim(), step: 0, value: 100, children: [] }
      stack.length = 0
      stack.push({ indent, node: treeData })
      continue
    }

    // Option node
    const optionMatch = content.match(/^- Option:\s*(.+)/)
    if (optionMatch) {
      const child = { name: optionMatch[1].trim(), step: 0, value: 50, children: [] }
      attachChild(treeData, child)
      stack.length = 0
      if (treeData) stack.push({ indent: 0, node: treeData })
      stack.push({ indent, node: child })
      continue
    }

    // Event or State node
    const eventMatch = content.match(/^- Event:\s*(.+?)\s*\|\s*Type:\s*(\w+)\s*\|\s*Value:\s*(\d+)/)
    if (eventMatch) {
      const parentOption = findOptionNode(treeData, stack)
      const child = {
        name: eventMatch[1].trim(),
        step: 1,
        eventType: eventMatch[2].trim(),
        value: parseInt(eventMatch[3]),
        children: [],
      }
      if (parentOption) parentOption.children.push(child)
      stack.push({ indent, node: child })
      continue
    }

    const stateMatch = content.match(/^- State:\s*(.+?)\s*\|\s*Type:\s*(\w+)\s*\|\s*Value:\s*(\d+)\s*\|\s*Prob:\s*(.+)/)
    if (stateMatch) {
      const leaf = {
        name: stateMatch[1].trim(),
        step: 2,
        eventType: stateMatch[2].trim(),
        value: parseInt(stateMatch[3]),
        probability_label: stateMatch[4].trim(),
      }
      // Attach to the current Event node in stack
      if (stack.length > 0) {
        const top = stack[stack.length - 1]
        if (!top.node.children) top.node.children = []
        top.node.children.push(leaf)
      }
      continue
    }
  }

  // 容错：确保 treeData 有基本结构
  if (!treeData) {
    treeData = { name: '决策', step: 0, value: 100, children: [] }
  }
  if (!treeData.children) treeData.children = []

  return treeData
}

// ── Step 3 Parser ──

export function parsePaths(rawText) {
  const paths = []
  const block = extractBlock(rawText, 'PATHS_START', 'PATHS_END')
  if (!block) return paths

  const lines = block.split('\n')
  let currentPath = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const pathMatch = trimmed.match(/^- Path:\s*(.+?)\s*\|\s*Name:\s*(.+?)\s*\|\s*Prob:\s*(.+?)\s*\|\s*Exp:\s*(.+)/)
    if (pathMatch) {
      if (currentPath) paths.push(currentPath)
      currentPath = {
        id: pathMatch[1].trim(),
        name: pathMatch[2].trim(),
        probability_label: pathMatch[3].trim(),
        explanation: pathMatch[4].trim(),
        timeline: [],
      }
      continue
    }

    const timelineMatch = trimmed.match(/^\*\s*TimelineEvent:\s*(.+?)\s*\|\s*Prob:\s*(.+?)\s*\|\s*Desc:\s*(.+?)\s*\|\s*Impact:\s*(.+?)\s*\|\s*Threshold:\s*(.+)/)
    if (timelineMatch && currentPath) {
      currentPath.timeline.push({
        event: timelineMatch[1].trim(),
        probability_label: timelineMatch[2].trim(),
        description: timelineMatch[3].trim(),
        impact: parseKeyValuePairs(timelineMatch[4]),
        threshold: parseKeyValuePairs(timelineMatch[5]),
      })
    }
  }
  if (currentPath) paths.push(currentPath)

  return paths
}

export function parseScores(rawText) {
  const scores = {}
  const block = extractBlock(rawText, 'SCORES_START', 'SCORES_END')
  if (!block) return scores

  const lines = block.split('\n')
  for (const line of lines) {
    const scoreMatch = line.match(/- Score:\s*(.+?)\s*->\s*(\d+)/)
    if (scoreMatch) {
      scores[scoreMatch[1].trim()] = parseInt(scoreMatch[2])
    }
  }

  return scores
}

export function parseRecommendation(rawText) {
  const block = extractBlock(rawText, 'RECOMMENDATION_START', 'RECOMMENDATION_END')
  return { analysis: block ? block.trim() : '' }
}

// ── Assemble ──

export function assembleModel(step1Raw, step2Raw, step3Raw, framework) {
  const { variables, weights } = parseVariables(step1Raw)
  const treeData = parseCausalTree(step2Raw)
  const paths = parsePaths(step3Raw)
  const scores = parseScores(step3Raw)
  const recommendation = parseRecommendation(step3Raw)

  const options = Array.isArray(framework?.options) ? [...framework.options] : []

  // 容错：treeData.children 名称补全
  if (treeData && Array.isArray(treeData.children)) {
    for (const child of treeData.children) {
      if (!options.includes(child.name)) {
        options.push(child.name)
      }
      // 容错：补全 risk_adjustment
      if (child.logic_payload && !child.logic_payload.risk_adjustment) {
        child.logic_payload.risk_adjustment = {
          保守: { offset: 0 },
          均衡: { offset: 0 },
          激进: { offset: 0 },
        }
      }
      // 容错：确保每个 option 至少有 2 个 children
      if (!child.children || child.children.length === 0) {
        child.children = []
      }
    }
  }

  return {
    options,
    variables,
    weights,
    treeData,
    paths,
    scores,
    recommendation,
  }
}

// ── Structure Validator ──

export function validateModelStructure(model) {
  const errors = []

  if (!model || typeof model !== 'object') {
    errors.push({ message: '模型为空', severity: 'error' })
    return errors
  }

  // 1. treeData 必须有基本结构
  if (!model.treeData || typeof model.treeData !== 'object') {
    errors.push({ message: 'treeData 缺失', severity: 'error' })
    return errors
  }
  if (!model.treeData.name) errors.push({ message: 'treeData.name 缺失', severity: 'error' })
  if (!Array.isArray(model.treeData.children) || model.treeData.children.length === 0) {
    errors.push({ message: 'treeData.children 为空', severity: 'error' })
    return errors
  }

  // 2. 每个 child.name 必须与 options 一致
  const optSet = new Set(model.options || [])
  for (const child of model.treeData.children) {
    if (!optSet.has(child.name)) {
      errors.push({ message: `treeData 子节点 "${child.name}" 不在 options 列表中`, severity: 'error' })
    }
  }

  // 3. logic_payload 分布：非叶子节点必须有，叶子节点禁止有
  function checkPayload(node, path) {
    if (!node || typeof node !== 'object') return
    const hasChildren = Array.isArray(node.children) && node.children.length > 0
    if (hasChildren && !node.logic_payload) {
      errors.push({ message: `${path} 缺少 logic_payload`, severity: 'error' })
    }
    if (!hasChildren && node.logic_payload) {
      // 非致命：叶子节点有 payload 是警告
      errors.push({ message: `${path} 叶子节点不应包含 logic_payload`, severity: 'warning' })
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((c, i) => checkPayload(c, `${path}.children[${i}]`))
    }
  }
  for (let i = 0; i < model.treeData.children.length; i++) {
    checkPayload(model.treeData.children[i], `treeData.children[${i}]`)
  }

  // 4. probability_label / delta_label 枚举值校验
  function checkLabels(node) {
    if (!node || typeof node !== 'object') return
    if (node.probability_label && !VALID_PROBABILITY_LABELS.includes(node.probability_label)) {
      errors.push({ message: `无效的 probability_label: "${node.probability_label}"`, severity: 'error' })
    }
    if (Array.isArray(node.logic_payload?.trade_offs)) {
      for (const t of node.logic_payload.trade_offs) {
        if (t.delta_label && !VALID_DELTA_LABELS.includes(t.delta_label)) {
          errors.push({ message: `无效的 delta_label: "${t.delta_label}"`, severity: 'error' })
        }
      }
    }
    if (Array.isArray(node.children)) node.children.forEach(checkLabels)
  }
  if (model.treeData) checkLabels(model.treeData)

  // paths 中的标签校验
  for (const p of model.paths || []) {
    if (p.probability_label && !VALID_PROBABILITY_LABELS.includes(p.probability_label)) {
      errors.push({ message: `paths 中无效的 probability_label: "${p.probability_label}"`, severity: 'error' })
    }
    for (const evt of p.timeline || []) {
      if (evt.probability_label && !VALID_PROBABILITY_LABELS.includes(evt.probability_label)) {
        errors.push({ message: `timeline 中无效的 probability_label: "${evt.probability_label}"`, severity: 'error' })
      }
    }
  }

  // 5. paths 的 impact key 与 variables 匹配
  const varNames = new Set((model.variables || []).map(v => v.name))
  if (varNames.size > 0) {
    for (const p of model.paths || []) {
      for (const evt of p.timeline || []) {
        for (const key of Object.keys(evt.impact || {})) {
          if (!varNames.has(key)) {
            errors.push({ message: `timeline impact 维度 "${key}" 不在变量列表中`, severity: 'warning' })
          }
        }
      }
    }
  }

  return errors
}

// ── Helpers ──

function extractBlock(text, startKey, endKey) {
  const startRe = new RegExp(`##\\s*${startKey}\\s*##`)
  const endRe = new RegExp(`##\\s*${endKey}\\s*##`)
  const startMatch = text.match(startRe)
  if (!startMatch) return null
  const afterStart = text.slice(startMatch.index + startMatch[0].length)
  const endMatch = afterStart.match(endRe)
  return endMatch ? afterStart.slice(0, endMatch.index) : afterStart
}

function parsePayload(lines) {
  const payload = {}
  for (const line of lines) {
    // trade_off: var -> delta_label
    const tradeOffMatch = line.match(/^trade_off:\s*(.+?)\s*->\s*(.+)/)
    if (tradeOffMatch) {
      if (!payload.trade_offs) payload.trade_offs = []
      payload.trade_offs.push({
        dimension: tradeOffMatch[1].trim(),
        delta_label: tradeOffMatch[2].trim(),
      })
      continue
    }

    // risk_adjustment: 保守:5 | 均衡:0 | 激进:-3
    const raMatch = line.match(/^risk_adjustment:\s*(.+)/)
    if (raMatch) {
      const parts = raMatch[1].split('|').map(p => p.trim())
      const offsets = {}
      for (const part of parts) {
        const m = part.match(/(保守|均衡|激进):\s*(-?\d+)/)
        if (m) offsets[m[1]] = { offset: parseInt(m[2]) }
      }
      payload.risk_adjustment = offsets
      continue
    }

    // key: value
    const kvMatch = line.match(/^(\w+):\s*(.+)/)
    if (kvMatch) {
      const val = kvMatch[2].trim()
      const numVal = parseFloat(val)
      payload[kvMatch[1]] = isNaN(numVal) ? val : numVal
    }
  }
  return payload
}

function parseKeyValuePairs(str) {
  const result = {}
  const pairs = str.split(/,\s*/)
  for (const pair of pairs) {
    const kv = pair.match(/^([^:]+)\s*:\s*(.+)/)
    if (kv) {
      const numVal = parseFloat(kv[2].trim())
      result[kv[1].trim()] = isNaN(numVal) ? kv[2].trim() : numVal
    }
  }
  return result
}

function attachChild(treeData, child) {
  if (treeData) {
    if (!treeData.children) treeData.children = []
    treeData.children.push(child)
  }
}

function findOptionNode(treeData, stack) {
  // Find the most recent Option-level node in stack
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].node.step === 0 && stack[i].node.name !== treeData?.name) {
      return stack[i].node
    }
  }
  // Fallback: return last option in treeData
  if (treeData?.children?.length) return treeData.children[treeData.children.length - 1]
  return null
}
