import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const db = _require(join(process.cwd(), 'utils/db.js'))

  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
  if (!user) throw createError({ statusCode: 401, message: 'Not authenticated' })
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const id = getRouterParam(event, 'id')
  const report = await db('reports').where({ id, user_id: user.id }).first()
  if (!report) throw createError({ statusCode: 404, message: 'Report not found' })

  return {
    ...report,
    results_json: report.results_json
      ? (typeof report.results_json === 'string' ? JSON.parse(report.results_json) : report.results_json)
      : null,
  }
})
