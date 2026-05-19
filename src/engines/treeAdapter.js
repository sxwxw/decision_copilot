import { Decimal } from 'decimal.js'
import { PROBABILITY_LABELS } from '../shared/qualitativeMap.js'

/**
 * 决策树适配器 — 将 LLM 输出标准化为前端组件契约。
 */

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

function extractEvents(path) {
  if (path.name) {
    return path.name.split('→').map(s => s.trim()).filter(Boolean)
  }
  if (path.timeline && path.timeline.length) {
    return path.timeline.map(e => e.event).filter(Boolean)
  }
  return []
}

function matchNode(nodeList, eventName, fallbackIndex) {
  const exact = nodeList.find(n => n.name === eventName)
  if (exact) return exact

  const partial = nodeList.find(n =>
    n.name.includes(eventName) || eventName.includes(n.name))
  if (partial) return partial

  return nodeList[fallbackIndex] || null
}

function _buildPathRefs(treeData, paths) {
  const optionNodes = {}
  for (const optChild of treeData.children || []) {
    optionNodes[optChild.name] = flattenTree(optChild, 1)
  }

  for (const path of paths) {
    const events = extractEvents(path)
    if (!events.length) continue

    const optionName = events[0]
    // 使用模糊匹配而非精确等号，兼容 LLM 缩写路径名
    const matchedOption = treeData.children?.find(c =>
      c.name === optionName || c.name.includes(optionName) || optionName.includes(c.name))
    if (!matchedOption) continue

    if (!matchedOption._pathRef) matchedOption._pathRef = []
    matchedOption._pathRef.push(path.id)

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

export function buildPathRefs(treeData, paths) {
  _buildPathRefs(treeData, paths)
}

export function adaptTree(rawTree, rawPaths) {
  let idCounter = 0
  const genId = () => `n-${++idCounter}`

  // eventProbMap: event name -> { cumulative, conditional }
  const eventProbMap = {}
  if (rawPaths && rawPaths.length) {
    for (const path of rawPaths) {
      if (!path.timeline) continue
      let cumulative = new Decimal(1)
      for (const evt of path.timeline) {
        const prob = evt.probability ?? PROBABILITY_LABELS[evt.probability_label]?.base ?? 1.0
        cumulative = cumulative.mul(prob)
        if (evt.event) {
          const cVal = cumulative.toDecimalPlaces(2).toNumber()
          const pVal = Math.round(prob * 100) / 100
          if (!eventProbMap[evt.event] || eventProbMap[evt.event].cumulative < cVal) {
            eventProbMap[evt.event] = { cumulative: cVal, conditional: pVal }
          }
        }
      }
    }
  }

  function adaptNode(node, depth) {
    const step = depth
    const rawName = node.name ?? ''
    const cleanName = rawName.replace(/^第[0-9]+年[：:]\s*/, '')

    const probEntry = eventProbMap[cleanName]
    let probability
    let cumulativeProbability
    if (node.probability !== undefined && node.probability !== null) {
      probability = node.probability
    } else if (probEntry !== undefined) {
      probability = probEntry.conditional
      cumulativeProbability = probEntry.cumulative
    } else {
      probability = null
    }
    const clampedProb = probability !== null ? Math.max(0, Math.min(1, parseFloat(probability.toFixed(2)))) : null

    const pathIds = Array.isArray(node._pathRef) ? [...node._pathRef] : []

    const adapted = {
      id: genId(),
      name: cleanName,
      step,
      score: node.value ?? 50,
      status: node.eventType || null,
      probability: clampedProb,
      cumulativeProbability: cumulativeProbability ?? null,
      isDashed: step >= 2,
      children: [],
      pathIds,
    }

    if (node.logic_payload) {
      adapted.logic_payload = node.logic_payload
    }

    if (node.children && node.children.length) {
      for (const child of node.children) {
        adapted.children.push(adaptNode(child, depth + 1))
      }
    }

    return adapted
  }

  if (rawPaths && rawPaths.length) {
    _buildPathRefs(rawTree, rawPaths)
  }

  const adapted = adaptNode(rawTree, 0)

  // Debug: log all leaf probabilities before normalization
  function collectLeaves(node, prefix) {
    const current = prefix ? [...prefix, node.name] : [node.name]
    if (!node.children || !node.children.length) {
      console.log('[adaptTree BEFORE normalize]', current.join(' > '), 'probability:', node.probability)
      return
    }
    for (const child of node.children) {
      collectLeaves(child, current)
    }
  }
  collectLeaves(adapted, [])

  // Normalize sibling probabilities at every level
  function normalizeProbabilities(node) {
    if (!node.children || !node.children.length) return
    for (const child of node.children) {
      normalizeProbabilities(child)
    }
    const children = node.children
    const hasMissing = children.some(c => c.probability === null)
    const knownSum = children.reduce((sum, c) => sum + (c.probability || 0), 0)

    if (hasMissing) {
      const remaining = Math.max(0, 1 - knownSum)
      const count = children.filter(c => c.probability === null).length
      const share = count > 0 ? remaining / count : 0
      console.log('[normalizeProb] node:', node.name, 'has missing siblings, knownSum:', knownSum, 'share:', share)
      for (const child of children) {
        if (child.probability === null) child.probability = Math.round(share * 100) / 100
      }
    } else if (Math.abs(knownSum - 1) > 0.001) {
      console.log('[normalizeProb] node:', node.name, 'sum ≠ 1:', knownSum)
      for (const child of children) {
        child.probability = Math.round(child.probability / knownSum * 100) / 100
      }
    } else {
      console.log('[normalizeProb] node:', node.name, 'OK, sum =', knownSum)
    }
  }
  normalizeProbabilities(adapted)

  // Debug: log all leaf probabilities after normalization
  function collectLeavesAfter(node, prefix) {
    const current = prefix ? [...prefix, node.name] : [node.name]
    if (!node.children || !node.children.length) {
      console.log('[adaptTree AFTER normalize]', current.join(' > '), 'probability:', node.probability)
      return
    }
    for (const child of node.children) {
      collectLeavesAfter(child, current)
    }
  }
  collectLeavesAfter(adapted, [])

  if (rawPaths && rawPaths.length) {
    adapted.pathIds = rawPaths.map(p => p.id)
  }

  return adapted
}

export { flattenTree, extractEvents, matchNode }
