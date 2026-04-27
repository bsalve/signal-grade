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
  const body = await readBody(event)

  const updates: Record<string, any> = {}
  if (typeof body.enabled === 'boolean') updates.enabled = body.enabled
  if (body.frequency === 'weekly' || body.frequency === 'monthly') {
    updates.frequency = body.frequency
    const next = new Date()
    if (body.frequency === 'weekly') next.setDate(next.getDate() + 7)
    else next.setDate(next.getDate() + 30)
    updates.next_run_at = next
  }

  if (Object.keys(updates).length === 0) throw createError({ statusCode: 400, message: 'Nothing to update' })

  const count = await db('scheduled_audits').where({ id, user_id: user.id }).update(updates)
  if (!count) throw createError({ statusCode: 404, message: 'Schedule not found' })

  const schedule = await db('scheduled_audits').where({ id }).first()
  return schedule
})
