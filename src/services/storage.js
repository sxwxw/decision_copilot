const STORAGE_KEY = 'decision-copilot-state'
const STORAGE_VERSION = 1

export function save(data) {
  if (!data?.model) return
  console.log('[Persistence] 保存模型到 localStorage')
  const payload = {
    version: STORAGE_VERSION,
    timestamp: Date.now(),
    ...data,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.error('[Persistence] 存储失败:', err)
  }
}

export function load() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  console.log('[Persistence] 发现本地缓存，尝试恢复')
  try {
    const data = JSON.parse(raw)
    if (data.version !== STORAGE_VERSION) {
      console.warn(`[Persistence] 版本不匹配 (local=${data.version}, current=${STORAGE_VERSION})，清除旧数据`)
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    if (!data.model || !data.model.treeData) {
      console.warn('[Persistence] 数据结构不完整，清除')
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return data
  } catch (err) {
    console.error('[Persistence] 解析失败，清除:', err)
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function clear() {
  localStorage.removeItem(STORAGE_KEY)
  console.log('[Persistence] 本地缓存已清除')
}
