import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const sessionUser = (session as any)?.user ?? null
  if (!sessionUser) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const db = _require(join(process.cwd(), 'utils/db.js'))
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const { url } = getQuery(event)
  if (!url || typeof url !== 'string') throw createError({ statusCode: 400, message: 'url required' })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  const rows = await db('cwv_history')
    .where({ user_id: sessionUser.id, url })
    .where('created_at', '>=', cutoff.toISOString())
    .orderBy('created_at', 'asc')
    .select('lcp_ms', 'tbt_ms', 'cls', 'performance_score', 'created_at')

  return rows
})
