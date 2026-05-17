import axios from 'axios'

/**
 * 自定义 axios 拦截器：将 400 响应中的 errors 数组透传，而非抛出异常。
 * 同时将 200 响应中的 warnings 字段附加到 data 上。
 */
const apiClient = axios.create()
apiClient.interceptors.response.use(
  response => response,
  error => {
    // 400 响应：返回 error.response.data（包含 errors 数组），而非抛出
    if (error.response && error.response.status === 400) {
      return { data: error.response.data, status: 400 }
    }
    return Promise.reject(error)
  }
)

export async function validateInput(userInput) {
  const { data } = await apiClient.post('/api/decision/validate', { userInput })
  return data
}

export async function createDecisionModel(userInput, riskPreference) {
  const { data, status } = await apiClient.post('/api/decision/model', { userInput, riskPreference })
  if (status === 400) return { errors: data.errors }
  return data
}

export async function simulateModel(userInput, paramValues) {
  const { data, status } = await apiClient.post('/api/decision/simulate', { userInput, paramValues })
  if (status === 400) return { errors: data.errors }
  return data
}

export async function deepPath(pathContext) {
  const { data } = await apiClient.post('/api/decision/deep-path', { pathContext })
  return data
}

export async function refineModel(currentModel, paramValues, userInput) {
  const { data, status } = await apiClient.post('/api/decision/refine', { currentModel, paramValues, userInput })
  if (status === 400) return { errors: data.errors }
  return data
}

export async function devilReview(currentModel, monteCarloResult) {
  const { data } = await apiClient.post('/api/decision/devil', { currentModel, monteCarloResult })
  return data
}

export async function runFramework(userInput, pipelineId) {
  const { data } = await apiClient.post('/api/decision/framework', { userInput, pipelineId })
  return data
}

export async function runBuildModel(userInput, frameworkResult, pipelineId) {
  const { data } = await apiClient.post('/api/decision/build-model', { userInput, frameworkResult, pipelineId })
  return data
}

export async function runFullPipeline(userInput, currentModel, riskPreference, { signal } = {}) {
  // SSE endpoint - returns EventSource compatible stream
  // If currentModel is provided, enters deep-validation mode
  return fetch('/api/decision/full-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userInput, currentModel, riskPreference }),
    signal,
  })
}

export async function getPipelineState(pipelineId) {
  const { data } = await apiClient.get(`/api/decision/pipeline/${pipelineId}`)
  return data
}

export async function resumePipeline(pipelineId) {
  const { data } = await apiClient.post(`/api/decision/pipeline/${pipelineId}/resume`)
  return data
}

export async function correctModel(pipelineId, paramValues) {
  const { data, status } = await apiClient.post('/api/decision/correct-model', { pipelineId, paramValues })
  if (status === 400) return { errors: data.errors }
  return data
}
