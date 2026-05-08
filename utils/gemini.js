'use strict';

const { createError } = require('h3')

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODELS = [
  'llama-3.1-8b-instant',
  'llama3-8b-8192',
]

// Global temperature for all Groq calls.
// 0.1 keeps structured outputs (MENTIONED:/NOT MENTIONED: prefixes, JSON schemas)
// reliable while still giving slight variation on Regenerate.
const GROQ_TEMPERATURE = 0.1

/**
 * Calls the Groq API (OpenAI-compatible) for LLM completions.
 * Throws h3 errors on failure so callers can propagate or catch as needed.
 */
async function callGemini(systemPrompt, userContent, maxTokens = 200) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw createError({ statusCode: 503, message: 'AI features are not configured.' })
  }

  for (const model of MODELS) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: maxTokens,
        temperature: GROQ_TEMPERATURE,
      }),
    })

    if (res.status === 429) {
      const errText = await res.text().catch(() => '')
      console.error(`[groq] ${model} returned 429, trying next...`, errText.slice(0, 150))
      continue
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[groq] error:', res.status, errText)
      throw createError({ statusCode: 502, message: 'AI service error.' })
    }

    const data = await res.json()
    const result = data.choices?.[0]?.message?.content?.trim() || ''
    if (!result) {
      throw createError({ statusCode: 502, message: 'AI returned an empty response.' })
    }
    return result
  }

  throw createError({ statusCode: 429, message: 'AI quota exceeded. Please try again shortly.' })
}

module.exports = { callGemini, GROQ_TEMPERATURE }
