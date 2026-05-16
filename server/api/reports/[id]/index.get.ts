import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const db = _require(join(process.cwd(), 'utils/db.js'))

  let user = null
  try {
    const session = await getUserSession(event)
    user = (session as any)?.user ?? null
  } catch {
    // malformed or expired session cookie — treat as unauthenticated
  }
  if (!user) throw createError({ statusCode: 401, message: 'Not authenticated' })
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const id = getRouterParam(event, 'id')
  let report
  try {
    report = await db('reports').where({ id, user_id: user.id }).first()
  } catch {
    throw createError({ statusCode: 500, message: 'Database error' })
  }
  if (!report) throw createError({ statusCode: 404, message: 'Report not found' })

  // Load fix tracker statuses for Pro/Agency (table may not exist yet — guard gracefully)
  let fixes: Record<string, string> = {}
  try {
    const fixRows = await db('report_fixes').where({ report_id: report.id }).select('check_name', 'status')
    for (const row of fixRows) fixes[row.check_name] = row.status
  } catch {}

  return {
    ...report,
    results_json: report.results_json
      ? (typeof report.results_json === 'string' ? JSON.parse(report.results_json) : report.results_json)
      : null,
    meta_json: report.meta_json
      ? (typeof report.meta_json === 'string' ? JSON.parse(report.meta_json) : report.meta_json)
      : null,
    ai_recs_json: report.ai_recs_json
      ? (typeof report.ai_recs_json === 'string' ? JSON.parse(report.ai_recs_json) : report.ai_recs_json)
      : null,
    fixes,
  }
})
