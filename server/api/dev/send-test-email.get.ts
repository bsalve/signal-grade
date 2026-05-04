import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  const session = await getUserSession(event)
  const user    = session?.user
  if (!user?.id) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const email = _require(join(process.cwd(), 'utils/email.js'))
  if (!email.isConfigured()) {
    throw createError({ statusCode: 503, message: 'Email not configured — set RESEND_API_KEY in .env' })
  }

  const to   = user.email
  const name = user.name
  const url  = 'https://example.com'

  const results = await Promise.allSettled([
    email.sendWelcome(to, name),
    email.sendRegressionAlert(to, name, url, 74, 58, 'F', {
      newFailures: ['Page Speed', 'Core Web Vitals', 'Canonical Tag'],
      topDrops:    [{ name: 'Page Speed', from: 72, to: 18 }, { name: 'Schema Validation', from: 60, to: 30 }],
      newPasses:   ['HTTPS / SSL', 'Meta Description'],
    }),
    email.sendScheduledReport(to, name, url, 81, 'B', 'http://localhost:3001/output/searchgrade-report-example-com-2026-05-01.pdf'),
  ])

  return {
    to,
    emails: ['welcome', 'regression_alert', 'scheduled_report'].map((type, i) => ({
      type,
      status: results[i].status,
      error: results[i].status === 'rejected' ? (results[i] as PromiseRejectedResult).reason?.message : undefined,
    })),
  }
})
