import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)
const db = _require(join(process.cwd(), 'utils/db.js'))

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
  if (!user?.id) throw createError({ statusCode: 401, message: 'Not authenticated' })
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'Invalid webhook ID' })

  // Verify ownership
  const hook = await db('webhooks').where({ id, user_id: user.id }).first()
  if (!hook) throw createError({ statusCode: 404, message: 'Webhook not found' })

  const deliveries = await db('webhook_deliveries')
    .where({ webhook_id: id })
    .orderBy('attempted_at', 'desc')
    .limit(10)
    .select('id', 'event', 'status_code', 'response_snippet', 'attempted_at')

  return deliveries
})
