import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)
const db = _require(join(process.cwd(), 'utils/db.js'))

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
  if (!user?.id) throw createError({ statusCode: 401, message: 'Not authenticated' })
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const id = getRouterParam(event, 'id')
  const deleted = await db('api_keys').where({ id, user_id: user.id }).delete()
  if (!deleted) throw createError({ statusCode: 404, message: 'API key not found' })
  return { ok: true }
})
