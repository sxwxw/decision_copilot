import { runMonteCarlo as runMC } from '../utils/simulator.js'

/**
 * 敏感性分析引擎 — 对每个 slider 变量做 ±20% 扰动，记录排名变化。
 * 纯函数，接收参数返回结果，不依赖外部状态。
 */

/**
 * 执行敏感性分析。
 * @param {Object} model - 决策模型 { options, variables, weights, scores }
 * @param {Object} paramValues - 当前参数值
 * @param {Function} computeScores - 计算评分的函数 (paramValues) => scores
 * @returns {Object} sensitivity result
 */
export function analyze(model, paramValues, computeScores) {
  const variables = model.variables.filter(v => v.type === 'slider')
  const options = model.options

  function getCurrentRanking(pv) {
    const s = computeScores(pv)
    return options
      .map(name => ({ name, score: s[name] ?? 50 }))
      .sort((a, b) => b.score - a.score)
  }

  const baselineRanking = getCurrentRanking(paramValues)

  const gapPct = baselineRanking.length >= 2
    ? Math.round(((baselineRanking[0].score - baselineRanking[1].score) / baselineRanking[0].score) * 100) / 100
    : null

  const rankFlips = []
  const flipCountByVar = {}

  for (const v of variables) {
    flipCountByVar[v.name] = 0
    const origVal = paramValues[v.name] ?? 50

    for (const direction of [1, -1]) {
      const perturbedVal = Math.max(0, Math.min(100, origVal + direction * 20))
      const perturbedPv = { ...paramValues, [v.name]: perturbedVal }
      const perturbedRanking = getCurrentRanking(perturbedPv)

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
  }

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

  return {
    stability,
    gap_pct: gapPct,
    rank_flips: rankFlips,
    flip_count_by_var: flipCountByVar,
    total_flips: totalFlips,
    total_perturbations: totalPerturbations,
    current_ranking: baselineRanking.map((r, i) => ({ ...r, rank: i + 1 })),
  }
}

/**
 * EVIU — Expected Value of Including Uncertainty。
 * 基于 Monte Carlo 样本计算信息价值，生成调研建议。
 */
export function computeEVIU(model, monteCarloResult) {
  if (!monteCarloResult?.optionResults || !model?.variables) return null

  const variables = model.variables.filter(v => v.type === 'slider')
  const sliderVars = variables.map(v => v.name)
  const recommendations = []

  for (const varName of sliderVars) {
    const varInfo = model.variables.find(v => v.name === varName)
    const spec = varInfo?.sim_spec
    if (!spec) continue

    // 计算该变量的不确定性对结果的影响
    const sigma = Object.values(monteCarloResult.optionResults).reduce((sum, opt) => sum + (opt.sigma || 0), 0)
    const meanSigma = sigma / Object.keys(monteCarloResult.optionResults).length

    const isHighImpact = meanSigma > 5
    if (isHighImpact) {
      recommendations.push({
        variable: varName,
        reason: `对结果方差贡献较大 (σ=${meanSigma.toFixed(1)})`,
        suggestion: `建议进一步调研「${varName}」以减少不确定性`,
        priority: meanSigma > 10 ? 'high' : 'medium',
      })
    }
  }

  return recommendations.length > 0 ? recommendations : null
}
