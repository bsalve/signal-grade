import { createRequire } from 'module'
import { join } from 'path'
import { createHash } from 'crypto'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const db = _require(join(process.cwd(), 'utils/db.js'))
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const body = await readBody(event)
  const { email, url, score, grade, apiKey } = body ?? {}

  if (!email || !url || !apiKey) {
    throw createError({ statusCode: 400, message: 'email, url, and apiKey are required' })
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    throw createError({ statusCode: 400, message: 'Invalid email address.' })
  }

  // Resolve api_key_id from key
  const key_hash = createHash('sha256').update(String(apiKey)).digest('hex')
  const keyRow = await db('api_keys').where({ key_hash }).select('id').first()
  if (!keyRow) throw createError({ statusCode: 401, message: 'Invalid API key' })

  try {
    await db('widget_leads').insert({
      api_key_id: keyRow.id,
      email: String(email).trim().toLowerCase(),
      url: String(url).trim(),
      score: score != null ? Number(score) : null,
      grade: grade ? String(grade) : null,
    })
  } catch {
    throw createError({ statusCode: 500, message: 'Could not save lead.' })
  }

  return { ok: true }
})
