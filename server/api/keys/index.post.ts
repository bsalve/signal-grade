import { createRequire } from 'module'
import { join } from 'path'
import { createHash, randomBytes } from 'crypto'

const _require = createRequire(import.meta.url)
const db = _require(join(process.cwd(), 'utils/db.js'))

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
  if (!user?.id) throw createError({ statusCode: 401, message: 'Not authenticated' })
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const body = await readBody(event)
  const label = (body?.label || '').toString().trim().slice(0, 100)

  // Enforce per-user key limit
  const [{ count }] = await db('api_keys').where({ user_id: user.id }).count('id as count')
  if (Number(count) >= 10) {
    throw createError({ statusCode: 400, message: 'Maximum of 10 API keys per account.' })
  }

  const plaintext = 'sg_' + randomBytes(32).toString('hex')
  const key_hash  = createHash('sha256').update(plaintext).digest('hex')

  const [id] = await db('api_keys').insert({ user_id: user.id, key_hash, label }).returning('id')
  return { id: id?.id ?? id, label, key: plaintext }
})
