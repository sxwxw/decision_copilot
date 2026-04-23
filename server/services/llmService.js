import fetch from 'node-fetch'

const QWEN_API_URL = process.env.DASHSCOPE_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen-plus'
const API_KEY = process.env.DASHSCOPE_API_KEY || ''

export async function callQwen(systemPrompt, userPrompt, retries = 2) {
  if (!API_KEY) {
    throw new Error('DASHSCOPE_API_KEY not configured')
  }

  // Ensure user prompt mentions "JSON" for relay validation
  const enhancedUserPrompt = userPrompt.includes('JSON') || userPrompt.includes('json')
    ? userPrompt
    : userPrompt + '（请以JSON格式返回）'

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(QWEN_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: QWEN_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: enhancedUserPrompt },
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
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
