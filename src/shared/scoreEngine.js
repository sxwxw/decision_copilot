import { Decimal } from 'decimal.js'

/**
 * 统一评分偏移计算。
 * 公式: (pv - base) * delta * 2 / 100 * weight
 * pv: 参数值 (0-100), base: 基准值 (默认 50), delta: 敏感度, weight: 权重
 */
export function calcScoreOffset(pv, delta, base = 50, weight = 1) {
  return (pv - base) * delta * 2 / 100 * weight
}

export function calcScoreOffsetDecimal(pv, delta, base = 50, weight = 1) {
  return new Decimal(pv)
    .minus(base)
    .mul(delta)
    .mul(2)
    .div(100)
    .mul(weight)
    .toNumber()
}
