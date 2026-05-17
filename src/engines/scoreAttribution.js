/**
 * 评分归因引擎 — 计算每个维度对评分变化的影响程度。
 * 接收 scores 作为参数，不依赖外部状态。
 */

/**
 * 获取评分归因文本。
 * @param {string} optionName
 * @param {Object} scores 当前评分
 * @param {Object} baseScores 基准评分
 * @param {Object} paramValues 当前参数值
 * @param {Object} weights 权重
 * @param {Object} sensitivityMap 敏感度映射 { optionName: { dimName: delta } }
 * @param {Object|null} snapshotWeights 快照权重
 */
export function getScoreAttribution(optionName, scores, baseScores, paramValues, weights, sensitivityMap, snapshotWeights) {
  const baseScore = baseScores?.[optionName] ?? 50
  const adj = scores?.[optionName] ?? baseScore
  const diff = Math.round((adj - baseScore) * 100) / 100
  if (Math.abs(diff) <= 5) return ''

  const dims = sensitivityMap?.[optionName] || {}

  let topDim = '', topDelta = 0, topParamValue = 50, topImpact = 0
  for (const [dim, d] of Object.entries(dims)) {
    if (weights?.[dim] === undefined) continue
    const pv = paramValues?.[dim] ?? 50
    const weight = weights[dim] ?? 1
    let impact
    if (snapshotWeights && snapshotWeights[dim] !== undefined) {
      impact = (pv - snapshotWeights[dim]) / 100 * d * 2 * weight
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

/**
 * 获取评分差异（反事实对比）。
 */
export function getScoreDiff(option, currentScores, previousScores) {
  if (!previousScores?.[option]) return null
  const current = currentScores?.[option] ?? previousScores[option]
  const diff = current - previousScores[option]
  return { before: previousScores[option], after: current, diff }
}

/**
 * 获取影响最大的维度。
 */
export function topImpactDimension(optionName, sensitivityMap, paramValues, weights) {
  const dims = sensitivityMap?.[optionName] || {}
  let topDim = null, topImpact = 0

  for (const [dim, delta] of Object.entries(dims)) {
    const pv = paramValues?.[dim] ?? 50
    const weight = weights?.[dim] ?? 1
    const impact = Math.abs((pv / 100 - 0.5) * delta * 2 * weight)
    if (impact > topImpact) {
      topImpact = impact
      topDim = { dimension: dim, delta, impact }
    }
  }
  return topDim
}
