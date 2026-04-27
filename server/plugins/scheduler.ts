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

        // Send email notification
        if (email.isConfigured()) {
          const user = await db('users').where({ id: job.user_id }).first()
          if (user?.email) {
            const reportId = await db('reports')
              .where({ user_id: job.user_id, url: job.url, audit_type: 'page' })
              .orderBy('created_at', 'desc')
              .first()
              .then((r: any) => r?.id)
            const downloadUrl = reportId
              ? `${process.env.APP_URL || ''}/api/reports/${reportId}/download`
              : `${process.env.APP_URL || ''}/dashboard`
            email.sendScheduledReport(user.email, user.name, job.url, score, grade, downloadUrl)
              .catch((e: any) => console.error('[scheduler] email failed:', e.message))
          }
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
