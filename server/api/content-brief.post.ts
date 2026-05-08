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
  const CACHE_KEY = '__content_brief__'

  // Return cached brief if available and not forcing regeneration
  if (reportId && !forceRegenerate && db) {
    try {
      const report = await db('reports').select('ai_recs_json').where({ id: reportId }).first()
      if (report?.ai_recs_json) {
        const recs = typeof report.ai_recs_json === 'string' ? JSON.parse(report.ai_recs_json) : report.ai_recs_json
        if (recs[CACHE_KEY]) {
          return { brief: recs[CACHE_KEY], cached: true }
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
    const h2s = $('h2').map((_: any, el: any) => $(el).text().trim()).get().slice(0, 8).join(' | ')
    const h3s = $('h3').map((_: any, el: any) => $(el).text().trim()).get().slice(0, 6).join(' | ')
    // Extract first 800 words of body text
    const bodyText = $('body').clone().find('script,style,nav,header,footer').remove().end()
      .text().replace(/\s+/g, ' ').trim()
    const words = bodyText.split(' ').slice(0, 800).join(' ')
    pageContext = `URL: ${url}\nH1: ${h1 || 'none'}\nH2s: ${h2s || 'none'}\nH3s: ${h3s || 'none'}\nBody (first 800 words): ${words}`
  } catch {
    pageContext = `URL: ${url}`
  }

  const { callGemini } = _require(join(process.cwd(), 'utils/gemini.js'))

  const systemPrompt =
    'You are an expert content strategist and SEO specialist. ' +
    'Generate a detailed content brief in strict JSON format only. ' +
    'No markdown, no explanation, no text outside the JSON object.'

  const userPrompt =
    `Generate a content brief for a page targeting "${h1 || url}". ` +
    `Return ONLY this JSON object with no other text:\n` +
    `{\n` +
    `  "targetKeywords": ["keyword1", "keyword2", "keyword3"],\n` +
    `  "recommendedWordCount": 1800,\n` +
    `  "outline": [\n` +
    `    { "heading": "H2 section title", "notes": "What to cover in this section" }\n` +
    `  ],\n` +
    `  "mustIncludeEntities": ["entity1", "entity2"],\n` +
    `  "faqSuggestions": ["Question 1?", "Question 2?"],\n` +
    `  "competitorAngle": "One sentence on the content gap or angle to exploit"\n` +
    `}\n\n` +
    `Page context:\n${pageContext}`

  let brief: any = null
  try {
    const raw = await callGemini(systemPrompt, userPrompt, 600)
    // Extract JSON object from response
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      brief = JSON.parse(match[0])
    } else {
      throw new Error('No JSON object in response')
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 502, message: 'Failed to generate content brief.' })
  }

  // Persist under the reserved cache key in ai_recs_json
  if (reportId && db) {
    try {
      const report = await db('reports').select('ai_recs_json').where({ id: reportId }).first()
      const recs = report?.ai_recs_json
        ? (typeof report.ai_recs_json === 'string' ? JSON.parse(report.ai_recs_json) : report.ai_recs_json)
        : {}
      recs[CACHE_KEY] = brief
      await db('reports').where({ id: reportId }).update({ ai_recs_json: JSON.stringify(recs) })
    } catch {}
  }

  return { brief }
})
