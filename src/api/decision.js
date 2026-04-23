import axios from 'axios'

export async function createDecisionModel(userInput) {
  const { data } = await axios.post('/api/decision/model', { userInput })
  return data
}

export async function simulateModel(userInput, paramValues) {
  const { data } = await axios.post('/api/decision/simulate', { userInput, paramValues })
  return data
}

export async function deepPath(pathContext) {
  const { data } = await axios.post('/api/decision/deep-path', { pathContext })
  return data
}
