import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)
const db = _require(join(process.cwd(), 'utils/db.js'))

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
  if (!user?.id) throw createError({ statusCode: 401, message: 'Not authenticated' })
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  // Key IDs belonging to this user
  const userKeys = await db('api_keys').where({ user_id: user.id }).select('id')
  const keyIds = userKeys.map((k: any) => k.id)
  if (!keyIds.length) return { callsToday: 0, callsMonth: 0, topEndpoints: [], recentCalls: [] }

  const now        = new Date()
  const dayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ count: callsToday }] = await db('api_usage_log')
    .whereIn('key_id', keyIds).where('ts', '>=', dayStart).count('id as count')

  const [{ count: callsMonth }] = await db('api_usage_log')
    .whereIn('key_id', keyIds).where('ts', '>=', monthStart).count('id as count')

  const topEndpoints = await db('api_usage_log')
    .whereIn('key_id', keyIds).where('ts', '>=', thirtyDaysAgo)
    .groupBy('endpoint')
    .orderBy('count', 'desc')
    .limit(5)
    .select('endpoint', db.raw('count(*) as count'))

  const recentCalls = await db('api_usage_log')
    .join('api_keys', 'api_usage_log.key_id', 'api_keys.id')
    .whereIn('api_usage_log.key_id', keyIds)
    .orderBy('api_usage_log.ts', 'desc')
    .limit(10)
    .select(
      'api_usage_log.endpoint',
      'api_usage_log.status_code',
      'api_usage_log.ts',
      'api_keys.label as key_label'
    )

  return {
    callsToday:    Number(callsToday),
    callsMonth:    Number(callsMonth),
    topEndpoints:  topEndpoints.map((r: any) => ({ endpoint: r.endpoint, count: Number(r.count) })),
    recentCalls,
  }
})
