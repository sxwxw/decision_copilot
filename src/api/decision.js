import axios from 'axios'

export async function validateInput(userInput) {
  const { data } = await axios.post('/api/decision/validate', { userInput })
  return data
}

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

export async function refineModel(currentModel, paramValues, userInput) {
  const { data } = await axios.post('/api/decision/refine', { currentModel, paramValues, userInput })
  return data
}
