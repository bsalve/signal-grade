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

          // Score regression alert: drop ≥10 points triggers an additional alert
          if (previous && (previous.score - score) >= 10) {
            try {
              const currResults: any[] = JSON.parse(current.results_json || '[]')
              const prevResults: any[] = JSON.parse(previous.results_json || '[]')
              const prevMap = Object.fromEntries(prevResults.map((r: any) => [r.name, r.status]))
              const newFailures = currResults
                .filter((r: any) => r.status === 'fail' && prevMap[r.name] !== 'fail')
                .map((r: any) => r.name)
              const newPasses = currResults
                .filter((r: any) => r.status === 'pass' && prevMap[r.name] === 'fail')
                .map((r: any) => r.name)
              if (email.isConfigured() && user.email) {
                email.sendRegressionAlert(user.email, user.name, job.url, previous.score, score, grade, { newFailures, newPasses })
                  .catch((e: any) => console.error('[scheduler] regression alert failed:', e.message))
              }
              const regressionPayload = { ...notifyPayload, type: 'regression', dropFrom: previous.score }
              if (user.notify_slack_url) notify.sendSlackNotification(user.notify_slack_url, regressionPayload).catch(() => {})
              if (user.notify_teams_url) notify.sendTeamsNotification(user.notify_teams_url, regressionPayload).catch(() => {})
            } catch (e: any) {
              console.error('[scheduler] regression diff failed:', e.message)
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
})
