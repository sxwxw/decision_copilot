/**
 * 纯 JS 协议防御拦截器：确保大模型返回的 Devil JSON 绝对安全
 * @param {string|Object} rawInput - 大模型返回的原始字符串或已被解析的 JSON
 * @returns {Object} 100% 符合内回路预期的结构体
 */
export function sanitizeDevilReview(rawInput) {
  let data = {}
  if (typeof rawInput === 'string') {
    try {
      const cleanedString = rawInput.replace(/```json/g, '').replace(/```/g, '').trim()
      data = JSON.parse(cleanedString)
    } catch {
      return { requires_refactor: false, severity: 'LOW', directives: [] }
    }
  } else if (rawInput && typeof rawInput === 'object') {
    data = rawInput
  }

  const requires_refactor = String(data.requires_refactor) === 'true'

  const rawSeverity = String(data.severity || 'LOW').toUpperCase()
  const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
  const severity = validSeverities.includes(rawSeverity) ? rawSeverity : 'LOW'

  const directives = []
  if (Array.isArray(data.directives)) {
    for (const item of data.directives) {
      if (item && typeof item === 'object') {
        directives.push({
          target: String(item.target || ''),
          action: String(item.action || ''),
          reason: String(item.reason || '')
        })
      }
    }
  }

  let finalRequiresRefactor = requires_refactor
  if (severity === 'CRITICAL' && directives.length > 0) {
    finalRequiresRefactor = true
  }

  return {
    requires_refactor: finalRequiresRefactor,
    severity,
    directives
  }
}
