import fetch from 'node-fetch'

const QWEN_API_URL = process.env.DASHSCOPE_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen-plus'
const API_KEY = process.env.DASHSCOPE_API_KEY || ''

export async function callQwen(systemPrompt, userPrompt, model, retries = 2, enableThinking = false, jsonMode = true) {
  if (!API_KEY) {
    throw new Error('DASHSCOPE_API_KEY not configured')
  }

  const modelName = model || QWEN_MODEL;

  let enhancedUserPrompt = userPrompt
  if (jsonMode) {
    // Ensure user prompt mentions "JSON" for relay validation
    enhancedUserPrompt = userPrompt.includes('JSON') || userPrompt.includes('json')
      ? userPrompt
      : userPrompt + '（请以JSON格式返回）'
  }

  const sysLen = systemPrompt ? systemPrompt.length : 0
  console.log('[callQwen] model:', modelName, '| url:', QWEN_API_URL, '| system_len:', sysLen, '| user_len:', userPrompt.length, '| jsonMode:', jsonMode)
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const body = {
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt || '' },
          { role: 'user', content: enhancedUserPrompt },
        ],
        temperature: 0.7,
        enable_thinking: enableThinking,
      }
      if (jsonMode) {
        body.response_format = { type: 'json_object' }
      }

      const res = await fetch(QWEN_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errBody = await res.text()
        throw new Error(`Qwen API error (${res.status}): ${errBody}`)
      }

      const json = await res.json()
      const content = json.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from Qwen API')
      }

      // If not in JSON mode, return raw text directly
      if (!jsonMode) {
        return content
      }

      // Parse JSON from response
      try {
        return JSON.parse(content)
      } catch {
        // Try to extract JSON from markdown code blocks
        const match = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/)
        if (match) {
          return JSON.parse(match[1])
        }
        throw new Error('Failed to parse JSON from LLM response')
      }
    } catch (err) {
      if (attempt === retries) throw err
      // Exponential backoff
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
}

/**
 * Lightweight LLM availability check via a minimal API call.
 */
export async function checkLlmAvailability() {
  if (!API_KEY) return false
  try {
    const res = await fetch(QWEN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: QWEN_MODEL,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
