import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const plan: string = event.context.plan ?? 'anon'
  if (plan !== 'pro' && plan !== 'agency') {
    throw createError({ statusCode: 403, message: 'Pro or Agency plan required' })
  }
  if (!process.env.GROQ_API_KEY) {
    throw createError({ statusCode: 503, message: 'GROQ_API_KEY not configured' })
  }

  const db      = _require(join(process.cwd(), 'utils/db.js'))
  const { callGemini }   = _require(join(process.cwd(), 'utils/gemini.js'))
  const { letterGrade }  = _require(join(process.cwd(), 'utils/score.js'))

  const body = await readBody(event)
  const { url, reportId } = body ?? {}
  if (!url) throw createError({ statusCode: 400, message: 'url is required' })

  const userId: number | null = event.context.userId ?? null

  // Load saved results from DB
  let resultsJson: any[] = []
  let savedScore: number | null = null
  let savedGrade: string | null = null

  if (reportId && db && userId) {
    try {
      const report = await db('reports')
        .select('results_json', 'score', 'grade', 'ai_summary')
        .where({ id: reportId, user_id: userId })
        .first()
      if (report?.ai_summary) {
        // Already cached — return immediately
        return { aiSummary: report.ai_summary }
      }
      if (report?.results_json) {
        resultsJson = typeof report.results_json === 'string'
          ? JSON.parse(report.results_json)
          : report.results_json
        savedScore = report.score
        savedGrade = report.grade
      }
    } catch {}
  }

  if (!resultsJson.length) {
    throw createError({ statusCode: 404, message: 'No audit results found for this report' })
  }

  const score = savedScore ?? 0
  const grade = savedGrade ?? letterGrade(score)
  const top5fails = resultsJson
    .filter((r: any) => r.status === 'fail')
    .sort((a: any, b: any) => (a.normalizedScore ?? 0) - (b.normalizedScore ?? 0))
    .slice(0, 5)
    .map((r: any) => `[${r.name}] Score: ${r.normalizedScore ?? 0}/100`)
    .join('\n')

  let aiSummary: string | null = null
  try {
    const raw = await callGemini(
      'You are an SEO consultant. Return ONLY a JSON object, no other text.\n' +
      'Schema: { "verdict": "1-sentence overall assessment", "priority": "single most important fix in 8 words or fewer", "issues": [{ "area": "Technical|Content|AEO|GEO", "finding": "10 words max", "impact": "high|medium|low" }], "quickWin": "one actionable sentence" }\n' +
      'issues: exactly 3 items. impact must be high, medium, or low.',
      `URL: ${url}\nScore: ${score}/100 (${grade})\n\nTop failing checks:\n${top5fails || 'No failing checks.'}`,
      300,
    )
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      aiSummary = JSON.stringify(parsed)
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 502, message: 'AI service unavailable' })
  }

  if (!aiSummary) throw createError({ statusCode: 502, message: 'AI service returned no content' })

  // Save back to DB so subsequent views use cache
  if (reportId && db && userId) {
    try {
      await db('reports').where({ id: reportId, user_id: userId }).update({ ai_summary: aiSummary })
    } catch {}
  }

  return { aiSummary }
})
