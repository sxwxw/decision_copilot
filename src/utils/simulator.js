// Monte Carlo simulation engine: 7 distribution samplers + main run function

const VALID_TYPES = ['normal', 'lognormal', 'triangular', 'beta', 'uniform', 'bernoulli', 'categorical']

/** Validate a single sim_spec object */
export function validateSimSpec(spec) {
  if (!spec || !spec.type) return false
  if (!VALID_TYPES.includes(spec.type)) return false
  const p = spec.params || {}
  switch (spec.type) {
    case 'normal':
      return typeof p.mean === 'number' && typeof p.sd === 'number' && p.sd > 0
    case 'lognormal':
      return typeof p.mean === 'number' && typeof p.sd === 'number' && p.sd > 0
    case 'triangular':
      return typeof p.min === 'number' && typeof p.mode === 'number' && typeof p.max === 'number'
        && p.min <= p.mode && p.mode <= p.max
    case 'beta':
      return typeof p.alpha === 'number' && typeof p.beta === 'number' && p.alpha > 0 && p.beta > 0
        && isFinite(p.alpha) && isFinite(p.beta) && p.alpha < 1000 && p.beta < 1000
    case 'uniform':
      return typeof p.min === 'number' && typeof p.max === 'number' && p.min < p.max
    case 'bernoulli':
      return typeof p.p === 'number' && p.p >= 0 && p.p <= 1
    case 'categorical':
      return Array.isArray(p.values) && Array.isArray(p.probabilities)
        && p.values.length === p.probabilities.length && p.probabilities.length > 0
        && Math.abs(p.probabilities.reduce((a, b) => a + b, 0) - 1.0) < 0.01
    default:
      return false
  }
}

// ── Random number generation ──

function rand() {
  return Math.random()
}

// Box-Muller transform for standard normal
function randn() {
  let u = 0, v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

// ── Distribution samplers ──

function sampleNormal(params) {
  return randn() * params.sd + params.mean
}

function sampleLognormal(params) {
  // mean/sd are in linear space; approximate log-space params
  const mu = Math.log(params.mean * params.mean / Math.sqrt(params.sd * params.sd + params.mean * params.mean))
  const sigma = Math.sqrt(Math.log(1 + (params.sd * params.sd) / (params.mean * params.mean)))
  return Math.exp(randn() * sigma + mu)
}

function sampleTriangular(params) {
  const { min, mode, max } = params
  const u = rand()
  const fc = (mode - min) / (max - min)
  if (u <= fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min))
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode))
}

function sampleBeta(params) {
  // Marsaglia and Tsang's method
  function gammaShape(a) {
    if (a < 1) return gammaShape(a + 1) * rand() ** (1 / a)
    const d = a - 1 / 3
    const c = 1 / Math.sqrt(9 * d)
    while (true) {
      let x, v
      do {
        x = randn()
        v = 1 + c * x
      } while (v <= 0)
      v = v * v * v
      const u = rand()
      if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
    }
  }
  const x = gammaShape(params.alpha)
  const y = gammaShape(params.beta)
  return x / (x + y)
}

function sampleUniform(params) {
  return params.min + rand() * (params.max - params.min)
}

function sampleBernoulli(params) {
  return rand() < params.p ? 1 : 0
}

function sampleCategorical(params) {
  // Normalize probabilities before sampling to avoid bias
  const probs = params.probabilities
  const total = probs.reduce((a, b) => a + b, 0)
  const normalized = total > 0 ? probs.map(p => p / total) : probs.map(() => 1 / probs.length)

  const u = Math.random()
  let cum = 0
  for (let i = 0; i < params.values.length; i++) {
    cum += normalized[i]
    if (u <= cum) return params.values[i]
  }
  return params.values[params.values.length - 1]
}

const samplers = {
  normal: sampleNormal,
  lognormal: sampleLognormal,
  triangular: sampleTriangular,
  beta: sampleBeta,
  uniform: sampleUniform,
  bernoulli: sampleBernoulli,
  categorical: sampleCategorical,
}

// ── Main simulation function ──

/**
 * Run Monte Carlo simulation.
 *
 * @param {Object} simSpec - { variables: [{name, sim_spec, weight}], options: [{name, base_score, trade_offs: [{dimension, delta}]}], riskPreference: string }
 * @param {number} numSamples - number of Monte Carlo samples
 * @returns {Object} { optionResults: { [optionName]: { p10, p50, p90, sigma, mean, samples: number[] } }, ranking: [{name, mean, rank}] }
 */
export function runMonteCarlo(simSpec, numSamples = 5000) {
  console.group('[MonteCarlo] ===== 开始仿真 =====')
  console.log('[MonteCarlo] numSamples:', numSamples, '| variables:', simSpec.variables.length, '| options:', simSpec.options.length)

  const { variables, options } = simSpec
  const riskPref = simSpec.riskPreference || '均衡'
  const varMap = {}
  for (const v of variables) {
    const spec = v.sim_spec || { type: 'uniform', params: { min: 0, max: 100 } }
    // Clamp Beta parameters to prevent extreme values
    if (spec.type === 'beta' && spec.params) {
      spec.params = {
        ...spec.params,
        alpha: Math.min(spec.params.alpha, 100),
        beta: Math.min(spec.params.beta, 100),
      }
    }
    if (!validateSimSpec(spec)) {
      console.warn('[MonteCarlo] 变量 "' + v.name + '" sim_spec 无效，回退到 uniform[0,100]', spec)
      varMap[v.name] = { type: 'uniform', params: { min: 0, max: 100 }, weight: v.weight || 0 }
    } else {
      varMap[v.name] = { ...spec, weight: v.weight || 0 }
    }
  }
  console.log('[MonteCarlo] 变量分布:', Object.fromEntries(Object.entries(varMap).map(([k, v]) => [k, { type: v.type, params: v.params }])))
  console.log('[MonteCarlo] 风险偏好:', riskPref)

  // Pre-select samplers
  const samplerList = variables.map(v => {
    const info = varMap[v.name]
    return { name: v.name, sampler: samplers[info.type], params: info.params, weight: info.weight }
  })

  // Build risk_adjustment lookup: { optionName: { offset } }
  const riskAdjMap = {}
  for (const opt of options) {
    const adj = opt.risk_adjustment?.[riskPref]
    riskAdjMap[opt.name] = {
      offset: adj?.offset ?? 0,
    }
  }

  // Run simulation
  const optionSamples = {}
  for (const opt of options) {
    optionSamples[opt.name] = []
  }

  for (let s = 0; s < numSamples; s++) {
    // Sample all variables
    const sampled = {}
    for (const item of samplerList) {
      let val = item.sampler(item.params)
      // Clamp to [0, 100] for score space
      val = Math.max(0, Math.min(100, val))
      sampled[item.name] = val
    }

    // Compute utility for each option
    for (const opt of options) {
      const base = opt.base_score ?? 50
      const tradeOffs = opt.trade_offs || []
      let utility = base
      for (const t of tradeOffs) {
        const dim = t.dimension
        if (sampled[dim] !== undefined) {
          const weight = varMap[dim]?.weight ?? 1
          const offset = (sampled[dim] / 100 - 0.5) * t.delta * 2 * weight
          utility += offset
        }
      }
      // Apply risk preference adjustment
      utility += riskAdjMap[opt.name].offset
      utility = Math.max(0, Math.min(100, utility))
      optionSamples[opt.name].push(utility)
    }
  }

  // Aggregate statistics
  const optionResults = {}
  for (const [name, samples] of Object.entries(optionSamples)) {
    samples.sort((a, b) => a - b)
    const n = samples.length
    const mean = samples.reduce((a, b) => a + b, 0) / n
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / n
    optionResults[name] = {
      p10: Math.round(samples[Math.floor(n * 0.1)] * 10) / 10,
      p50: Math.round(samples[Math.floor(n * 0.5)] * 10) / 10,
      p90: Math.round(samples[Math.floor(n * 0.9)] * 10) / 10,
      sigma: Math.round(Math.sqrt(variance) * 10) / 10,
      mean: Math.round(mean * 10) / 10,
    }
  }

  // Ranking by mean utility
  const ranking = Object.entries(optionResults)
    .map(([name, stats]) => ({ name, mean: stats.mean }))
    .sort((a, b) => b.mean - a.mean)
    .map((item, idx) => ({ ...item, rank: idx + 1 }))

  console.log('[MonteCarlo] 仿真结果:', optionResults)
  console.log('[MonteCarlo] 排名:', ranking.map(r => `${r.rank}. ${r.name} (${r.mean})`).join(', '))
  console.groupEnd()

  return { optionResults, ranking }
}
