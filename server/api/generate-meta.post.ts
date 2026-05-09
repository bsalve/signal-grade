import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const { requirePro } = _require(join(process.cwd(), 'utils/tiers.js'))
  requirePro(event)

  const body = await readBody(event)
  const { url, type, reportId, forceRegenerate } = body ?? {}

  if (!url || !type || !['title', 'description'].includes(type)) {
    throw createError({ statusCode: 400, message: 'url and type (title|description) are required' })
  }

  const db = _require(join(process.cwd(), 'utils/db.js'))
  const CACHE_KEY = type === 'title' ? '__meta_title__' : '__meta_desc__'

  // Return cached variations if available and not forcing regeneration
  if (reportId && !forceRegenerate && db) {
    try {
      const report = await db('reports').select('ai_recs_json').where({ id: reportId }).first()
      if (report?.ai_recs_json) {
        const recs = typeof report.ai_recs_json === 'string' ? JSON.parse(report.ai_recs_json) : report.ai_recs_json
        if (recs[CACHE_KEY]) {
          const cached = recs[CACHE_KEY]
          // New format: array of 3 variations
          if (Array.isArray(cached)) return { type, variations: cached, cached: true }
          // Legacy format: single string
          return { type, generated: cached, cached: true }
        }
      }
    } catch {}
  }

  // Fetch the page and extract key content signals
  const { fetchPage } = _require(join(process.cwd(), 'utils/fetcher.js'))
  let pageContext = ''
  try {
    const { $ } = await fetchPage(url)
    const h1 = $('h1').first().text().trim()
    const h2s = $('h2').map((_: any, el: any) => $(el).text().trim()).get().slice(0, 4).join(', ')
    const bodyText = $('body').clone().find('script,style').remove().end().text().replace(/\s+/g, ' ').trim().slice(0, 800)
    const existingTitle = $('title').first().text().trim()
    const existingDesc  = $('meta[name="description"]').attr('content')?.trim() || ''
    pageContext = `URL: ${url}\nH1: ${h1 || 'none'}\nH2s: ${h2s || 'none'}\nExisting title: ${existingTitle || 'none'}\nExisting description: ${existingDesc || 'none'}\nBody excerpt: ${bodyText}`
  } catch {
    pageContext = `URL: ${url}`
  }

  const systemPrompt = type === 'title'
    ? 'You are an SEO expert. Return ONLY a JSON array of exactly 3 title tag variations. No text before or after the array.\n' +
      'Rules per title: 50-60 characters, include primary keyword near start, no clickbait.\n' +
      'Each variation uses a different angle: [0] benefit-led, [1] keyword-led, [2] question-led.'
    : 'You are an SEO expert. Return ONLY a JSON array of exactly 3 meta description variations. No text before or after the array.\n' +
      'Rules per description: 120-155 characters, include primary keyword, include a subtle CTA.\n' +
      'Each variation uses a different tone: [0] direct, [1] inviting, [2] urgency-focused.'

  const { callGemini } = _require(join(process.cwd(), 'utils/gemini.js'))

  try {
    const raw = await callGemini(systemPrompt, pageContext, 350)
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array in response')
    const variations: string[] = JSON.parse(match[0])

    // Persist to cache
    if (reportId && db) {
      try {
        const report = await db('reports').select('ai_recs_json').where({ id: reportId }).first()
        const recs = report?.ai_recs_json
          ? (typeof report.ai_recs_json === 'string' ? JSON.parse(report.ai_recs_json) : report.ai_recs_json)
          : {}
        recs[CACHE_KEY] = variations
        await db('reports').where({ id: reportId }).update({ ai_recs_json: JSON.stringify(recs) })
      } catch {}
    }

    return { type, variations }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 502, message: 'Failed to contact AI service.' })
  }
})
