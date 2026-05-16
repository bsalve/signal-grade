import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user    = (session as any)?.user
  if (!user?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const db = _require(join(process.cwd(), 'utils/db.js'))
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const reportId = parseInt(getRouterParam(event, 'id') || '', 10)
  if (!reportId) throw createError({ statusCode: 400, message: 'Invalid report ID' })

  // Verify report belongs to user
  const report = await db('reports').where({ id: reportId, user_id: user.id }).first()
  if (!report) throw createError({ statusCode: 404, message: 'Report not found' })

  const { checkName, status } = await readBody(event) as { checkName?: string; status?: string }
  if (!checkName || !['todo', 'in_progress', 'fixed'].includes(status || '')) {
    throw createError({ statusCode: 400, message: 'checkName and valid status required' })
  }

  await db('report_fixes')
    .insert({ report_id: reportId, check_name: checkName, status, updated_at: new Date() })
    .onConflict(['report_id', 'check_name'])
    .merge(['status', 'updated_at'])

  return { ok: true }
})
