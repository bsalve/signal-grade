import { createRequire } from 'module'
import { join } from 'path'
import { createHmac } from 'crypto'

const _require = createRequire(import.meta.url)
const db = _require(join(process.cwd(), 'utils/db.js'))

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
  if (!user?.id) throw createError({ statusCode: 401, message: 'Not authenticated' })
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'Invalid webhook ID' })

  const hook = await db('webhooks').where({ id, user_id: user.id }).first()
  if (!hook) throw createError({ statusCode: 404, message: 'Webhook not found' })

  const payload = {
    event: 'test',
    data: { message: 'This is a test delivery from SearchGrade.' },
    timestamp: new Date().toISOString(),
  }
  const body = JSON.stringify(payload)
  const sig  = createHmac('sha256', hook.secret).update(body).digest('hex')

  let statusCode = 0
  let responseSnippet: string | null = null
  try {
    const resp = await fetch(hook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SearchGrade-Signature': `sha256=${sig}` },
      body,
      signal: AbortSignal.timeout(8000),
    })
    statusCode = resp.status
    const text = await resp.text().catch(() => '')
    responseSnippet = text.slice(0, 200) || null
  } catch (err: any) {
    statusCode = 0
    responseSnippet = (err.message || 'Connection failed').slice(0, 200)
  }

  await db('webhook_deliveries').insert({
    webhook_id: id,
    event: 'test',
    status_code: statusCode,
    response_snippet: responseSnippet,
  }).catch(() => {})

  return { statusCode, responseSnippet, success: statusCode >= 200 && statusCode < 300 }
})
