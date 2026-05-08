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

  // Return cached gaps if available and not forcing regeneration
  if (reportId && !forceRegenerate && db) {
    try {
      const report = await db('reports').select('ai_recs_json').where({ id: reportId }).first()
      if (report?.ai_recs_json) {
        const recs = typeof report.ai_recs_json === 'string' ? JSON.parse(report.ai_recs_json) : report.ai_recs_json
        if (recs[CACHE_KEY]) {
          return { gaps: recs[CACHE_KEY], cached: true }
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
    'You are an expert content strategist and SEO specialist. ' +
    'Analyze the provided page content and identify missing topics. ' +
    'Plain text only — no markdown, no asterisks, no bullet points, no headers.'

  const userPrompt =
    `For a page about "${h1 || url}", list 5-8 specific subtopics, questions, or content angles ` +
    `that a reader would expect to find but that are NOT covered on this page. ` +
    `Return ONLY a JSON array of strings. Example: ["How to ...", "What is ...", "Compare ..."]. ` +
    `No other text before or after the array.\n\n${pageContext}`

  let gaps: string[] = []
  try {
    const raw = await callGemini(systemPrompt, userPrompt, 400)
    // Parse JSON array from response
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) {
      gaps = JSON.parse(match[0])
    } else {
      // Fallback: split numbered/bulleted lines
      gaps = raw.split('\n')
        .map((l: string) => l.replace(/^[\d\.\-\*\s]+/, '').trim())
        .filter((l: string) => l.length > 5)
        .slice(0, 8)
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 502, message: 'Failed to contact AI service.' })
  }

  // Persist under the reserved cache key in ai_recs_json
  if (reportId && db) {
    try {
      const report = await db('reports').select('ai_recs_json').where({ id: reportId }).first()
      const recs = report?.ai_recs_json
        ? (typeof report.ai_recs_json === 'string' ? JSON.parse(report.ai_recs_json) : report.ai_recs_json)
        : {}
      recs[CACHE_KEY] = gaps
      await db('reports').where({ id: reportId }).update({ ai_recs_json: JSON.stringify(recs) })
    } catch {}
  }

  return { gaps }
})
