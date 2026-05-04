import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const { requirePro } = _require(join(process.cwd(), 'utils/tiers.js'))
  requirePro(event)

  const body = await readBody(event)
  const { url, checkName, message, details, reportId, forceRegenerate } = body ?? {}

  if (!url || !checkName) {
    throw createError({ statusCode: 400, message: 'url and checkName are required' })
  }

  const db = _require(join(process.cwd(), 'utils/db.js'))

  // Return cached recommendation if available and not forcing regeneration
  if (reportId && !forceRegenerate && db) {
    try {
      const report = await db('reports').select('ai_recs_json').where({ id: reportId }).first()
      if (report?.ai_recs_json) {
        const recs = typeof report.ai_recs_json === 'string' ? JSON.parse(report.ai_recs_json) : report.ai_recs_json
        if (recs[checkName]) {
          return { recommendation: recs[checkName], cached: true }
        }
      }
    } catch {}
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

  const { callGemini } = _require(join(process.cwd(), 'utils/gemini.js'))

  try {
    const recommendation = await callGemini(
      'You are an SEO expert reviewing a specific audit finding for a web page. ' +
      'Give a 1–2 sentence actionable fix that is specific to this exact page and its content. ' +
      'Be concrete — reference what you see on the page, not generic advice. ' +
      'Plain text only — no markdown, no asterisks, no bold markers, no bullet points. Return ONLY the recommendation.',
      userMessage,
      150,
    )

    // Persist to cache
    if (reportId && db) {
      try {
        const report = await db('reports').select('ai_recs_json').where({ id: reportId }).first()
        const recs = report?.ai_recs_json
          ? (typeof report.ai_recs_json === 'string' ? JSON.parse(report.ai_recs_json) : report.ai_recs_json)
          : {}
        recs[checkName] = recommendation
        await db('reports').where({ id: reportId }).update({ ai_recs_json: JSON.stringify(recs) })
      } catch {}
    }

    return { recommendation }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 502, message: 'Failed to contact AI service.' })
  }
})
