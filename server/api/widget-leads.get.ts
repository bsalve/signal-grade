import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const sessionUser = (session as any)?.user ?? null
  if (!sessionUser) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const db = _require(join(process.cwd(), 'utils/db.js'))
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  // Get all leads for api_keys belonging to this user
  const leads = await db('widget_leads')
    .join('api_keys', 'widget_leads.api_key_id', 'api_keys.id')
    .where({ 'api_keys.user_id': sessionUser.id })
    .select(
      'widget_leads.id',
      'widget_leads.email',
      'widget_leads.url',
      'widget_leads.score',
      'widget_leads.grade',
      'widget_leads.created_at',
      'api_keys.label as key_label',
    )
    .orderBy('widget_leads.created_at', 'desc')
    .limit(500)

  return leads
})
