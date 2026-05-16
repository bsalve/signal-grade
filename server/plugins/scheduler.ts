import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineNitroPlugin(() => {
  // Poll every 10 minutes for due scheduled audits
  setInterval(async () => {
    const db    = _require(join(process.cwd(), 'utils/db.js'))
    const email = _require(join(process.cwd(), 'utils/email.js'))
    if (!db) return

    let due: any[]
    try {
      due = await db('scheduled_audits')
        .where('enabled', true)
        .where('next_run_at', '<=', new Date())
        .limit(10)
    } catch {
      return
    }

    if (!due.length) return

    const audits: any[] = useNitroApp().audits ?? []

    for (const job of due) {
      try {
        const { runAudit } = _require(join(process.cwd(), 'utils/runAudit.js'))
        const { score, grade, r2Key, pdfFile } = await runAudit({
          url: job.url,
          userId: job.user_id,
          audits,
        })

        // Compute next run date
        const next = new Date()
        if (job.frequency === 'weekly') next.setDate(next.getDate() + 7)
        else next.setDate(next.getDate() + 30)

        await db('scheduled_audits').where({ id: job.id }).update({
          last_run_at: new Date(),
          next_run_at: next,
        })

        // Send email + Slack/Teams notification
        const user = await db('users').where({ id: job.user_id }).first()
        if (user) {
          // Fetch the 2 most recent reports (runAudit already inserted the current one)
          const recentReports = await db('reports')
            .select('id', 'score', 'results_json')
            .where({ user_id: job.user_id, url: job.url, audit_type: 'page' })
            .whereNull('deleted_at')
            .orderBy('created_at', 'desc')
            .limit(2)
          const [current, previous] = recentReports
          const reportId = current?.id ?? null

          const notify = _require(join(process.cwd(), 'utils/notify.js'))
          const notifyPayload = { url: job.url, score, grade, title: 'Scheduled Audit' }

          // Diff current vs previous results for monitoring alerts
          if (previous) {
            try {
              const currResults: any[] = JSON.parse(current.results_json || '[]')
              const prevResults: any[] = JSON.parse(previous.results_json || '[]')
              const prevMap = Object.fromEntries(prevResults.map((r: any) => [r.name, r.status]))
              const currMap = Object.fromEntries(currResults.map((r: any) => [r.name, r.status]))
              const newFailures = currResults
                .filter((r: any) => r.status === 'fail' && prevMap[r.name] !== 'fail')
                .map((r: any) => r.name)
              const newPasses = currResults
                .filter((r: any) => r.status === 'pass' && prevMap[r.name] === 'fail')
                .map((r: any) => r.name)

              // Score regression ≥10 points
              if ((previous.score - score) >= 10) {
                if (email.isConfigured() && user.email) {
                  email.sendRegressionAlert(user.email, user.name, job.url, previous.score, score, grade, { newFailures, newPasses })
                    .catch((e: any) => console.error('[scheduler] regression alert failed:', e.message))
                }
                const regressionPayload = { ...notifyPayload, type: 'regression', dropFrom: previous.score }
                if (user.notify_slack_url) notify.sendSlackNotification(user.notify_slack_url, regressionPayload).catch(() => {})
                if (user.notify_teams_url) notify.sendTeamsNotification(user.notify_teams_url, regressionPayload).catch(() => {})
              }

              // Noindex flip: Meta Robots newly failing
              const noindexFlipped = newFailures.some((n: string) => n.includes('Meta Robots'))
              if (noindexFlipped && (user.notify_slack_url || user.notify_teams_url || (email.isConfigured() && user.email))) {
                const p = { ...notifyPayload, type: 'monitor.noindex', title: 'Noindex Detected' }
                if (user.notify_slack_url) notify.sendSlackNotification(user.notify_slack_url, p).catch(() => {})
                if (user.notify_teams_url) notify.sendTeamsNotification(user.notify_teams_url, p).catch(() => {})
              }

              // SSL issue: SSL check newly failing
              const sslFlipped = newFailures.some((n: string) => n.includes('[Technical] SSL') || n.includes('HTTPS'))
              if (sslFlipped && (user.notify_slack_url || user.notify_teams_url)) {
                const p = { ...notifyPayload, type: 'monitor.ssl', title: 'SSL Issue Detected' }
                if (user.notify_slack_url) notify.sendSlackNotification(user.notify_slack_url, p).catch(() => {})
                if (user.notify_teams_url) notify.sendTeamsNotification(user.notify_teams_url, p).catch(() => {})
              }

              // New broken links ≥5 (compare counts from details if available)
              const brokenLinksCurr = currResults.find((r: any) => r.name.includes('Broken Links'))
              const brokenLinksPrev = prevResults.find((r: any) => r.name.includes('Broken Links'))
              const brokenCurrCount = brokenLinksCurr?.failCount ?? (brokenLinksCurr?.status === 'fail' ? 999 : 0)
              const brokenPrevCount = brokenLinksPrev?.failCount ?? (brokenLinksPrev?.status === 'fail' ? 0 : 0)
              if (brokenCurrCount - brokenPrevCount >= 5 && (user.notify_slack_url || user.notify_teams_url)) {
                const p = { ...notifyPayload, type: 'monitor.broken_links', title: `${brokenCurrCount} Broken Links Detected` }
                if (user.notify_slack_url) notify.sendSlackNotification(user.notify_slack_url, p).catch(() => {})
                if (user.notify_teams_url) notify.sendTeamsNotification(user.notify_teams_url, p).catch(() => {})
              }
            } catch (e: any) {
              console.error('[scheduler] monitoring diff failed:', e.message)
            }
          }

          if (email.isConfigured() && user.email) {
            const downloadUrl = reportId
              ? `${process.env.APP_URL || ''}/api/reports/${reportId}/download`
              : `${process.env.APP_URL || ''}/dashboard`
            email.sendScheduledReport(user.email, user.name, job.url, score, grade, downloadUrl)
              .catch((e: any) => console.error('[scheduler] email failed:', e.message))
          }
          if (user.notify_slack_url) notify.sendSlackNotification(user.notify_slack_url, notifyPayload).catch(() => {})
          if (user.notify_teams_url) notify.sendTeamsNotification(user.notify_teams_url, notifyPayload).catch(() => {})
        }
      } catch (e: any) {
        console.error(`[scheduler] audit failed for ${job.url}:`, e.message)
        // Still advance next_run_at to avoid hammering a broken URL
        const next = new Date()
        if (job.frequency === 'weekly') next.setDate(next.getDate() + 7)
        else next.setDate(next.getDate() + 30)
        await db('scheduled_audits').where({ id: job.id }).update({ next_run_at: next }).catch(() => {})
      }
    }
  }, 10 * 60 * 1000)

  // Digest aggregation — runs every hour, sends weekly/monthly digests on schedule
  setInterval(async () => {
    const db    = _require(join(process.cwd(), 'utils/db.js'))
    const email = _require(join(process.cwd(), 'utils/email.js'))
    if (!db || !email.isConfigured()) return

    const now = new Date()
    const dayOfWeek  = now.getUTCDay()  // 0=Sun, 1=Mon…
    const dayOfMonth = now.getUTCDate()

    // Weekly digest fires on Mondays; monthly on the 1st of each month
    const sendWeekly  = dayOfWeek === 1
    const sendMonthly = dayOfMonth === 1

    if (!sendWeekly && !sendMonthly) return

    let users: any[]
    try {
      users = await db('users')
        .whereNotNull('digest_frequency')
        .whereNotNull('email')
        .select('id', 'name', 'email', 'digest_frequency')
    } catch { return }

    for (const user of users) {
      if (user.digest_frequency === 'weekly'  && !sendWeekly)  continue
      if (user.digest_frequency === 'monthly' && !sendMonthly) continue

      // Gather one latest report per distinct URL for this user
      let items: any[]
      try {
        // Latest report per URL (subquery approach via raw)
        items = await db('reports as r')
          .select(
            'r.url', 'r.score', 'r.grade',
            db.raw('(SELECT score FROM reports r2 WHERE r2.user_id = r.user_id AND r2.url = r.url AND r2.audit_type = \'page\' AND r2.deleted_at IS NULL ORDER BY r2.created_at DESC LIMIT 1 OFFSET 1) AS prev_score'),
            db.raw('(SELECT results_json FROM reports r2 WHERE r2.user_id = r.user_id AND r2.url = r.url AND r2.audit_type = \'page\' AND r2.deleted_at IS NULL ORDER BY r2.created_at DESC LIMIT 1) AS results_json'),
          )
          .where({ 'r.user_id': user.id, 'r.audit_type': 'page' })
          .whereNull('r.deleted_at')
          .whereIn('r.id', function (this: any) {
            this.select(db.raw('MAX(id)')).from('reports').where({ user_id: user.id, audit_type: 'page' }).whereNull('deleted_at').groupBy('url')
          })
      } catch { continue }

      if (!items.length) continue

      const digestItems = items.map((row: any) => {
        let domain = row.url
        try { domain = new URL(row.url).hostname } catch {}

        let topIssue = ''
        try {
          const results: any[] = JSON.parse(row.results_json || '[]')
          const fail = results.find((r: any) => r.status === 'fail')
          topIssue = fail?.name?.replace(/^\[.*?\]\s*/, '') || ''
        } catch {}

        const delta = (row.prev_score !== null && row.prev_score !== undefined)
          ? row.score - row.prev_score
          : null

        return {
          domain,
          latestScore: row.score,
          grade:       row.grade,
          delta,
          topIssue,
        }
      })

      email.sendDigestEmail(user.email, user.name, digestItems, user.digest_frequency)
        .catch((e: any) => console.error(`[scheduler] digest email failed for ${user.email}:`, e.message))
    }
  }, 60 * 60 * 1000) // every hour
})
