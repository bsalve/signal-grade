import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user    = session?.user
  if (!user?.id) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readBody(event)
  const slackUrl = body?.slackUrl?.trim() || null
  const teamsUrl = body?.teamsUrl?.trim() || null
  const digestFrequency = body?.digestFrequency || null

  // Basic URL validation — must be https:// or empty
  if (slackUrl && !slackUrl.startsWith('https://')) {
    throw createError({ statusCode: 400, message: 'Slack URL must start with https://' })
  }
  if (teamsUrl && !teamsUrl.startsWith('https://')) {
    throw createError({ statusCode: 400, message: 'Teams URL must start with https://' })
  }
  if (digestFrequency !== null && !['weekly', 'monthly'].includes(digestFrequency)) {
    throw createError({ statusCode: 400, message: 'digestFrequency must be weekly, monthly, or null' })
  }

  const db = _require(join(process.cwd(), 'utils/db.js'))
  if (!db) throw createError({ statusCode: 503, message: 'Database unavailable' })

  const update: Record<string, any> = {
    notify_slack_url: slackUrl,
    notify_teams_url: teamsUrl,
  }
  if (digestFrequency !== undefined) {
    update.digest_frequency = digestFrequency
  }
  if (body?.widgetLeadCapture !== undefined) {
    update.widget_lead_capture = !!body.widgetLeadCapture
  }

  try {
    await db('users').where({ id: user.id }).update(update)
  } catch {
    throw createError({ statusCode: 500, message: 'Could not save settings.' })
  }

  return { ok: true }
})
