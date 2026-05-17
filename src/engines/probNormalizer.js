/**
 * 概率归一化 — 确保概率数组总和精确为 1.0。
 * 使用最大余数法（Hamilton method）分配舍入误差。
 */
export function normalizeProbabilities(probs) {
  const cleaned = probs.map(p => {
    if (typeof p !== 'number' || isNaN(p) || !isFinite(p) || p < 0) return 0
    return p
  })

  const total = cleaned.reduce((a, b) => a + b, 0)

  if (total === 0) {
    const uniform = 1 / cleaned.length
    return cleaned.map(() => uniform)
  }

  const decimals = cleaned.map(p => (p / total) * 100)
  const floored = decimals.map(d => Math.floor(d))
  const remainders = decimals.map((d, i) => d - floored[i])

  // 计算余数总和，将剩余名额分配给余数最大的项
  let assigned = floored.reduce((a, b) => a + b, 0)
  let remainderSlots = 100 - assigned

  // 按余数降序排序，分配剩余名额
  const indices = floored.map((_, i) => i)
  indices.sort((a, b) => remainders[b] - remainders[a])
  for (let i = 0; i < Math.min(remainderSlots, indices.length); i++) {
    floored[indices[i]]++
  }

  return floored.map(f => f / 100)
}
