import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const db = _require(join(process.cwd(), 'utils/db.js'))

  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
  if (!user) throw createError({ statusCode: 401, message: 'Not authenticated' })
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const plan = event.context.plan ?? 'free'
  if (plan !== 'pro' && plan !== 'agency') {
    throw createError({ statusCode: 403, message: 'Scheduled audits require a Pro or Agency plan.' })
  }

  const body = await readBody(event)
  const { url, frequency } = body ?? {}
  if (!url || typeof url !== 'string') throw createError({ statusCode: 400, message: 'url is required' })
  if (!['weekly', 'monthly'].includes(frequency)) throw createError({ statusCode: 400, message: 'frequency must be weekly or monthly' })

  try { const p = new URL(url); if (p.protocol !== 'http:' && p.protocol !== 'https:') throw new Error() }
  catch { throw createError({ statusCode: 400, message: 'Invalid URL' }) }

  // Enforce a reasonable per-user limit
  const existing = await db('scheduled_audits').where({ user_id: user.id }).count('id as count').first()
  const limit = plan === 'agency' ? 20 : 5
  if (parseInt(existing.count) >= limit) {
    throw createError({ statusCode: 400, message: `You can have up to ${limit} scheduled audits on your plan.` })
  }

  const now = new Date()
  const next = new Date(now)
  if (frequency === 'weekly') next.setDate(next.getDate() + 7)
  else next.setDate(next.getDate() + 30)

  const [schedule] = await db('scheduled_audits')
    .insert({ user_id: user.id, url, frequency, next_run_at: next })
    .returning('*')

  return schedule
})
