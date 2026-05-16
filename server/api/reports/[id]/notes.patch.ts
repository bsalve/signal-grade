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

  const report = await db('reports').where({ id: reportId, user_id: user.id }).first()
  if (!report) throw createError({ statusCode: 404, message: 'Report not found' })

  const { notes } = await readBody(event) as { notes?: string }
  if (typeof notes !== 'string') throw createError({ statusCode: 400, message: 'notes must be a string' })

  await db('reports').where({ id: reportId }).update({ notes: notes.slice(0, 10000) || null })

  return { ok: true }
})
