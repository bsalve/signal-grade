import { createRequire } from 'module'
import { join } from 'path'
import { createHash } from 'crypto'

const _require = createRequire(import.meta.url)
const db = _require(join(process.cwd(), 'utils/db.js'))

export default defineEventHandler(async (event) => {
  const auth = getRequestHeader(event, 'authorization') || ''
  if (!auth.startsWith('Bearer sg_')) return

  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const token    = auth.slice('Bearer '.length)
  const key_hash = createHash('sha256').update(token).digest('hex')

  const row = await db('api_keys')
    .join('users', 'api_keys.user_id', 'users.id')
    .where({ 'api_keys.key_hash': key_hash })
    .select('users.id as userId', 'users.plan', 'api_keys.id as keyId')
    .first()

  if (!row) throw createError({ statusCode: 401, message: 'Invalid API key' })

  // Update last_used_at without blocking the request
  db('api_keys').where({ id: row.keyId }).update({ last_used_at: new Date() }).catch(() => {})

  // Log API usage (fire-and-forget; only log named audit/API endpoints)
  const path = getRequestURL(event).pathname
  if (path.startsWith('/audit') || path.startsWith('/crawl') || path.startsWith('/multi-audit') ||
      path.startsWith('/bulk-audit') || path.startsWith('/widget-audit') || path.startsWith('/api/')) {
    db('api_usage_log').insert({ key_id: row.keyId, endpoint: path.slice(0, 200), status_code: 200 }).catch(() => {})
  }

  // Expose user context so the rate limiter and route handlers can read it
  event.context.apiKeyUser = { id: row.userId, plan: row.plan || 'free' }
})
