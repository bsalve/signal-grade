import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const sessionUser = (session as any)?.user ?? null
  if (!sessionUser) throw createError({ statusCode: 401, message: 'Not authenticated' })

  // Agency-only
  if (sessionUser.plan !== 'agency') {
    throw createError({ statusCode: 403, message: 'White-label branding requires Agency plan.' })
  }

  const body = await readBody(event)
  const { brandColor, whiteLabel } = body ?? {}

  // Validate hex color if provided
  let safeColor: string | null = null
  if (brandColor && typeof brandColor === 'string') {
    if (/^#[0-9a-fA-F]{3,6}$/.test(brandColor.trim())) {
      safeColor = brandColor.trim().toLowerCase()
    } else {
      throw createError({ statusCode: 400, message: 'Invalid color format. Use a hex value like #4d9fff.' })
    }
  }

  const db = _require(join(process.cwd(), 'utils/db.js'))
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  await db('users').where({ id: sessionUser.id }).update({
    brand_color: safeColor,
    white_label: whiteLabel === true,
  })

  return { ok: true }
})
