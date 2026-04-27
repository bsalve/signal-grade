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
  const deleted = await db('scheduled_audits').where({ id, user_id: user.id }).delete()
  if (!deleted) throw createError({ statusCode: 404, message: 'Schedule not found' })

  return { ok: true }
})
