import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user    = (session as any)?.user
  if (!user?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const db = _require(join(process.cwd(), 'utils/db.js'))
  if (!db) return { ok: true }  // No-op if no DB configured

  await db('users').where({ id: user.id }).update({ onboarded_at: new Date() })
  return { ok: true }
})
