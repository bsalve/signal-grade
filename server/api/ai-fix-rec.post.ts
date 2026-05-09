import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const { requirePro } = _require(join(process.cwd(), 'utils/tiers.js'))
  requirePro(event)

  const body = await readBody(event)
  const { url, checkName, message, details, reportId, forceRegenerate, siteMode, failCount, pageCount, sampleUrls } = body ?? {}

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

  // Build context — site mode skips page fetch, uses aggregated data instead
  let userMessage: string
  let systemPrompt: string

  if (siteMode) {
    const samples = Array.isArray(sampleUrls) ? sampleUrls.slice(0, 3).join(', ') : ''
    userMessage = [
      `Check: ${checkName}`,
      message ? `Finding: ${message}` : '',
      '',
      `Site: ${url}`,
      `Pages crawled: ${pageCount ?? 'unknown'}`,
      `Failing on: ${failCount ?? 'unknown'}/${pageCount ?? '?'} pages`,
      samples ? `Sample failing URLs: ${samples}` : '',
    ].filter(Boolean).join('\n')
    systemPrompt =
      'You are an SEO expert reviewing a site-wide audit finding affecting multiple pages. Return ONLY a JSON object, no other text.\n' +
      'Schema: { "fix": "1 sentence: what to fix across all affected pages", "why": "1 sentence: the ranking or visibility impact", "effort": "low|medium|high", "steps": ["step 1", "step 2", "step 3"] }\n' +
      'fix: be specific about the pattern to fix site-wide — no generic advice. steps: 2-3 items, each under 12 words. effort must be low, medium, or high.'
  } else {
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
    userMessage = [
      `Check: ${checkName}`,
      message  ? `Finding: ${message}`  : '',
      details  ? `Details: ${details}`  : '',
      '',
      pageContext,
    ].filter(Boolean).join('\n')
    systemPrompt =
      'You are an SEO expert reviewing a specific audit finding for a web page. Return ONLY a JSON object, no other text.\n' +
      'Schema: { "fix": "1 sentence: what to do, specific to this exact page", "why": "1 sentence: the ranking or visibility impact", "effort": "low|medium|high", "steps": ["step 1", "step 2", "step 3"] }\n' +
      'fix: reference what you see on the page — no generic advice. steps: 2-3 items, each under 12 words. effort must be low, medium, or high.'
  }

  const { callGemini } = _require(join(process.cwd(), 'utils/gemini.js'))

  try {
    const raw = await callGemini(systemPrompt, userMessage, 250)

    let recommendation: any
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        recommendation = JSON.parse(jsonMatch[0])
      } catch {
        recommendation = raw
      }
    } else {
      recommendation = raw
    }

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
