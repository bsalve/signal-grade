import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw createError({ statusCode: 503, message: 'AI features are not configured.' })
  }

  const plan = event.context.plan ?? 'anon'
  if (plan !== 'pro' && plan !== 'agency') {
    throw createError({ statusCode: 403, message: 'AI Fix Recommendations require a Pro or Agency plan.' })
  }

  const body = await readBody(event)
  const { url, checkName, message, details } = body ?? {}

  if (!url || !checkName) {
    throw createError({ statusCode: 400, message: 'url and checkName are required' })
  }

  // Fetch the page for context
  const { fetchPage } = _require(join(process.cwd(), 'utils/fetcher.js'))
  let pageContext = ''
  try {
    const { $ } = await fetchPage(url)
    const h1       = $('h1').first().text().trim()
    const h2s      = $('h2').map((_: any, el: any) => $(el).text().trim()).get().slice(0, 3).join(', ')
    const bodyText = $('body').clone().find('script,style').remove().end().text().replace(/\s+/g, ' ').trim().slice(0, 600)
    pageContext = `URL: ${url}\nH1: ${h1 || 'none'}\nH2s: ${h2s || 'none'}\nBody excerpt: ${bodyText}`
  } catch {
    pageContext = `URL: ${url}`
  }

  const userMessage = [
    `Check: ${checkName}`,
    message  ? `Finding: ${message}`  : '',
    details  ? `Details: ${details}`  : '',
    '',
    pageContext,
  ].filter(Boolean).join('\n')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: 'You are an SEO expert reviewing a specific audit finding for a web page. ' +
                'Give a 1–2 sentence actionable fix that is specific to this exact page and its content. ' +
                'Be concrete — reference what you see on the page, not generic advice. ' +
                'Return ONLY the recommendation text — no preamble, no bullet points, no explanation.',
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[ai-fix-rec] Anthropic error:', res.status, errText)
      throw createError({ statusCode: 502, message: 'AI service error.' })
    }

    const data: any = await res.json()
    const recommendation = data.content?.[0]?.text?.trim() || ''

    if (!recommendation) throw createError({ statusCode: 502, message: 'AI returned an empty response.' })

    return { recommendation }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 502, message: 'Failed to contact AI service.' })
  }
})
