import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)
const db = _require(join(process.cwd(), 'utils/db.js'))

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
  if (!user?.id) throw createError({ statusCode: 401, message: 'Not authenticated' })
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const keys = await db('api_keys')
    .where({ user_id: user.id })
    .orderBy('created_at', 'desc')
    .select('id', 'label', 'key_hash', 'created_at', 'last_used_at')

  return keys.map((k: any) => ({
    id: k.id,
    label: k.label,
    prefix: k.key_hash.slice(0, 8) + '…',
    created_at: k.created_at,
    last_used_at: k.last_used_at,
  }))
})
