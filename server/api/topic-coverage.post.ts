import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const { requirePro } = _require(join(process.cwd(), 'utils/tiers.js'))
  requirePro(event)

  const body = await readBody(event)
  const { url, reportId, forceRegenerate } = body ?? {}

  if (!url) {
    throw createError({ statusCode: 400, message: 'url is required' })
  }

  const db = _require(join(process.cwd(), 'utils/db.js'))
  const CACHE_KEY = '__topic_coverage__'

  // Return cached result if available and not forcing regeneration
  if (reportId && !forceRegenerate && db) {
    try {
      const report = await db('reports').select('ai_recs_json').where({ id: reportId }).first()
      if (report?.ai_recs_json) {
        const recs = typeof report.ai_recs_json === 'string' ? JSON.parse(report.ai_recs_json) : report.ai_recs_json
        if (recs[CACHE_KEY]) {
          const cached = recs[CACHE_KEY]
          // Legacy format: flat array of strings
          if (Array.isArray(cached)) return { gaps: cached, cached: true }
          // New format: structured object
          return { ...cached, cached: true }
        }
      }
    } catch {}
  }

  // Fetch the page for context
  const { fetchPage } = _require(join(process.cwd(), 'utils/fetcher.js'))
  let h1 = ''
  let pageContext = ''
  try {
    const { $ } = await fetchPage(url)
    h1 = $('h1').first().text().trim()
    const h2s  = $('h2').map((_: any, el: any) => $(el).text().trim()).get().slice(0, 8).join(' | ')
    const h3s  = $('h3').map((_: any, el: any) => $(el).text().trim()).get().slice(0, 5).join(' | ')
    const body = $('body').clone().find('script,style').remove().end().text().replace(/\s+/g, ' ').trim().slice(0, 500)
    pageContext = `URL: ${url}\nH1: ${h1 || 'none'}\nH2s: ${h2s || 'none'}\nH3s: ${h3s || 'none'}\nFirst 500 chars: ${body}`
  } catch {
    pageContext = `URL: ${url}`
  }

  const { callGemini } = _require(join(process.cwd(), 'utils/gemini.js'))

  const systemPrompt =
    'You are an expert content strategist and SEO specialist. Return ONLY a JSON object, no other text.\n' +
    'Schema: { "contentScore": 1-10, "scoreSummary": "1 sentence on overall coverage quality", "gaps": [{ "topic": "the missing topic or question", "intent": "informational|commercial|navigational", "priority": "high|medium|low", "suggestedAngle": "8 words max on how to address it" }] }\n' +
    'Return 5-7 gaps sorted by priority descending. intent and priority must use the exact values shown.'

  const userPrompt =
    `Analyze content coverage for a page about "${h1 || url}".\n\n${pageContext}`

  let contentScore: number | null = null
  let scoreSummary: string | null = null
  let gaps: any[] = []
  try {
    const raw = await callGemini(systemPrompt, userPrompt, 500)
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      contentScore = parsed.contentScore ?? null
      scoreSummary = parsed.scoreSummary ?? null
      gaps = Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 7) : []
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 502, message: 'Failed to contact AI service.' })
  }

  const result = { contentScore, scoreSummary, gaps }

  // Persist under the reserved cache key in ai_recs_json
  if (reportId && db) {
    try {
      const report = await db('reports').select('ai_recs_json').where({ id: reportId }).first()
      const recs = report?.ai_recs_json
        ? (typeof report.ai_recs_json === 'string' ? JSON.parse(report.ai_recs_json) : report.ai_recs_json)
        : {}
      recs[CACHE_KEY] = result
      await db('reports').where({ id: reportId }).update({ ai_recs_json: JSON.stringify(recs) })
    } catch {}
  }

  return result
})
