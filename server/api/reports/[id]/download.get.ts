import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const db = _require(join(process.cwd(), 'utils/db.js'))
  const r2 = _require(join(process.cwd(), 'utils/r2.js'))

  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
  if (!user) throw createError({ statusCode: 401, message: 'Not authenticated' })
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const id = getRouterParam(event, 'id')
  const report = await db('reports').where({ id, user_id: user.id }).first()
  if (!report) throw createError({ statusCode: 404, message: 'Report not found' })

  if (report.r2_key && r2.isConfigured()) {
    const url = await r2.getPresignedUrl(report.r2_key)
    return sendRedirect(event, url, 302)
  }

  if (report.pdf_filename) {
    return sendRedirect(event, `/output/${report.pdf_filename}`, 302)
  }

  throw createError({ statusCode: 404, message: 'No PDF available for this report' })
})
