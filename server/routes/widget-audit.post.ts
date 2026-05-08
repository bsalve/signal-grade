import { createRequire } from 'module'
import { join } from 'path'
import { createHash } from 'crypto'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const { fetchPage }   = _require(join(process.cwd(), 'utils/fetcher.js'))
  const { calcTotalScore, letterGrade } = _require(join(process.cwd(), 'utils/score.js'))
  const db = _require(join(process.cwd(), 'utils/db.js'))

  const body = await readBody(event)
  const { url, apiKey } = body ?? {}
  if (!url)    throw createError({ statusCode: 400, message: 'url is required' })
  if (!apiKey) throw createError({ statusCode: 401, message: 'API key required' })
  if (!db)     throw createError({ statusCode: 503, message: 'Database not available' })

  // Validate API key and check plan
  const key_hash = createHash('sha256').update(String(apiKey)).digest('hex')
  const row = await db('api_keys')
    .join('users', 'api_keys.user_id', 'users.id')
    .where({ 'api_keys.key_hash': key_hash })
    .select('users.plan', 'users.widget_lead_capture', 'api_keys.id as keyId')
    .first()

  if (!row) throw createError({ statusCode: 401, message: 'Invalid API key' })

  const plan = row.plan || 'free'
  if (plan !== 'pro' && plan !== 'agency') {
    throw createError({ statusCode: 403, message: 'Widget requires a Pro or Agency plan.' })
  }

  const leadCaptureEnabled = !!row.widget_lead_capture

  // Update last_used_at
  db('api_keys').where({ id: row.keyId }).update({ last_used_at: new Date() }).catch(() => {})

  const audits: any[] = useNitroApp().audits ?? []

  const { html, $, headers, finalUrl, responseTimeMs } = await fetchPage(String(url))
  const meta = { headers, finalUrl, responseTimeMs }
  const results = (
    await Promise.all(audits.map((a) => new Promise((resolve) => resolve(a($, html, url, meta))).catch(() => null)))
  ).flat().filter(Boolean)

  const score = calcTotalScore(results)
  const grade = letterGrade(score)

  return { score, grade, results, leadCaptureEnabled }
})
