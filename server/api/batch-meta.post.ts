import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const { requirePro } = _require(join(process.cwd(), 'utils/tiers.js'))
  requirePro(event)

  const body = await readBody(event)
  const { urls, type } = body ?? {}

  if (!Array.isArray(urls) || !urls.length || !['title', 'description'].includes(type)) {
    throw createError({ statusCode: 400, message: 'urls (array) and type (title|description) are required' })
  }

  const batch = urls.slice(0, 20)
  const { fetchPage } = _require(join(process.cwd(), 'utils/fetcher.js'))
  const { callGemini } = _require(join(process.cwd(), 'utils/gemini.js'))

  const systemPrompt = type === 'title'
    ? 'You are an SEO expert. Return ONLY a JSON array of exactly 3 title tag variations. No text before or after the array.\n' +
      'Rules per title: 50-60 characters, include primary keyword near start, no clickbait.\n' +
      'Each variation uses a different angle: [0] benefit-led, [1] keyword-led, [2] question-led.'
    : 'You are an SEO expert. Return ONLY a JSON array of exactly 3 meta description variations. No text before or after the array.\n' +
      'Rules per description: 120-155 characters, include primary keyword, include a subtle CTA.\n' +
      'Each variation uses a different tone: [0] direct, [1] inviting, [2] urgency-focused.'

  const results: { url: string; variations?: string[]; error?: boolean }[] = []

  for (const url of batch) {
    let pageContext = `URL: ${url}`
    try {
      const { $ } = await fetchPage(url)
      const h1 = $('h1').first().text().trim()
      const h2s = $('h2').map((_: any, el: any) => $(el).text().trim()).get().slice(0, 4).join(', ')
      const bodyText = $('body').clone().find('script,style').remove().end().text().replace(/\s+/g, ' ').trim().slice(0, 600)
      const existingTitle = $('title').first().text().trim()
      const existingDesc  = $('meta[name="description"]').attr('content')?.trim() || ''
      pageContext = `URL: ${url}\nH1: ${h1 || 'none'}\nH2s: ${h2s || 'none'}\nExisting title: ${existingTitle || 'none'}\nExisting description: ${existingDesc || 'none'}\nBody excerpt: ${bodyText}`
    } catch {}

    try {
      const raw = await callGemini(systemPrompt, pageContext, 350)
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('No JSON array in response')
      const variations: string[] = JSON.parse(match[0])
      results.push({ url, variations })
    } catch {
      results.push({ url, error: true })
    }
  }

  return { results }
})
