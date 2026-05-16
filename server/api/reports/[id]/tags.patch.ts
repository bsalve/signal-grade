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

  const { tags } = await readBody(event) as { tags?: string[] }
  if (!Array.isArray(tags)) throw createError({ statusCode: 400, message: 'tags must be an array' })

  // Validate: max 5 tags, each max 20 chars, alphanumeric + dash + space
  const clean = tags
    .map(t => String(t).trim().slice(0, 20))
    .filter(t => /^[a-zA-Z0-9\- ]+$/.test(t) && t.length > 0)
    .slice(0, 5)

  await db('reports').where({ id: reportId }).update({ tags: db.raw('?', [clean]) })

  return { ok: true, tags: clean }
})
