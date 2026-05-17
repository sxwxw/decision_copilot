/**
 * 高斯 Copula / Cholesky 分解 — 实现相关抽样。
 * 被 simulator.js 调用，用于生成具有指定相关结构的变量样本。
 */

function randn() {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

/**
 * Cholesky 分解：A = L * L^T
 * @param {number[][]} matrix - 对称正定矩阵
 * @returns {number[][]} 下三角矩阵 L
 */
export function cholesky(matrix) {
  const n = matrix.length
  const L = Array.from({ length: n }, () => new Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k]
      }
      L[i][j] = i === j
        ? Math.sqrt(matrix[i][i] - sum)
        : (matrix[i][j] - sum) / L[j][j]
    }
  }
  return L
}

/**
 * 使用高斯 Copula 生成相关正态变量。
 * @param {number[][]} correlationMatrix - N×N 相关矩阵
 * @returns {number[]} N 个相关标准正态变量
 */
export function sampleCorrelated(correlationMatrix) {
  const n = correlationMatrix.length
  const L = cholesky(correlationMatrix)
  const z = Array.from({ length: n }, () => randn())

  const result = new Array(n)
  for (let i = 0; i < n; i++) {
    let sum = 0
    for (let j = 0; j <= i; j++) {
      sum += L[i][j] * z[j]
    }
    result[i] = sum
  }
  return result
}

/**
 * 将独立均匀变量 [0,1] 转换为相关正态变量，再映射回原分布。
 * @param {Object} opts
 * @param {number[][]} opts.correlationMatrix
 * @param {function[]} opts.samplers - 每个变量的采样函数
 * @param {Object[]} opts.params - 每个变量的参数
 * @param {function} opts.uniformRand - 独立均匀随机数生成器
 * @returns {number[]}
 */
export function correlatedSample({ correlationMatrix, samplers, params }) {
  const n = correlationMatrix.length
  const correlatedNormals = sampleCorrelated(correlationMatrix)

  return correlatedNormals.map((z, i) => {
    // 将标准正态 z 转换为均匀 u = Φ(z)，再用逆 CDF 映射到目标分布
    const u = 0.5 * (1 + erf(z / Math.sqrt(2)))
    // 近似：用 u 作为分位数输入到采样器
    return samplers[i]({ ...params[i], _quantile: u })
  })
}

function erf(x) {
  // Approximation of error function
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return sign * y
}
