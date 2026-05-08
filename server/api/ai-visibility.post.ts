import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const { requirePro } = _require(join(process.cwd(), 'utils/tiers.js'))
  requirePro(event)

  const session = await getUserSession(event)
  const sessionUser = (session as any)?.user ?? null
  if (!sessionUser) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const body = await readBody(event)
  const { url } = body ?? {}
  if (!url) throw createError({ statusCode: 400, message: 'url is required' })

  const db = _require(join(process.cwd(), 'utils/db.js'))
  const { runVisibilityScan } = _require(join(process.cwd(), 'utils/aiVisibility.js'))

  const result = await runVisibilityScan(sessionUser.id, url, db)

  if (result.error) {
    throw createError({ statusCode: 503, message: result.error })
  }

  return result
})
