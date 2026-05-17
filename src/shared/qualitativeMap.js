/**
 * 定性标签到定量数值的映射表 + 反向解析。
 * 用于在 LLM 语义层与确定性代码层之间建立清晰边界。
 */

/** 概率标签：五档制（极高/高/中/低/极低） */
export const PROBABILITY_LABELS = {
  '极高': { base: 0.90, range: [0.85, 0.95] },
  '高': { base: 0.70, range: [0.60, 0.80] },
  '中': { base: 0.50, range: [0.40, 0.60] },
  '低': { base: 0.25, range: [0.15, 0.35] },
  '极低': { base: 0.05, range: [0.01, 0.10] },
}

/** Delta 标签：七档制 */
export const DELTA_LABELS = {
  '强正向': { base: 15 },
  '中正向': { base: 10 },
  '弱正向': { base: 5 },
  '无影响': { base: 0 },
  '弱负向': { base: -5 },
  '中负向': { base: -10 },
  '强负向': { base: -15 },
}

/** 将概率数值反向映射为定性标签 */
export function numberToProbabilityLabel(num) {
  for (const [label, { range }] of Object.entries(PROBABILITY_LABELS)) {
    if (num >= range[0] && num <= range[1]) return label
  }
  // 容错范围外的值，取最近的标签
  const entries = Object.entries(PROBABILITY_LABELS)
  let closest = entries[0]
  let minDist = Infinity
  for (const [label, { base }] of entries) {
    const dist = Math.abs(num - base)
    if (dist < minDist) {
      minDist = dist
      closest = [label, { base }]
    }
  }
  return closest[0]
}

/** 将 delta 数值反向映射为定性标签 */
export function numberToDeltaLabel(num) {
  for (const [label, { base }] of Object.entries(DELTA_LABELS)) {
    if (num === base) return label
  }
  const entries = Object.entries(DELTA_LABELS)
  let closest = entries[0]
  let minDist = Infinity
  for (const [label, { base }] of entries) {
    const dist = Math.abs(num - base)
    if (dist < minDist) {
      minDist = dist
      closest = [label, { base }]
    }
  }
  return closest[0]
}
