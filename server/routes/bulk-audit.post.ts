import { createEventStream } from 'h3'
import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

function friendlyError(msg: string): string {
  if (/ENOTFOUND|ECONNREFUSED|EAI_AGAIN/.test(msg)) return 'Could not reach this URL — check the domain is correct and the site is live'
  if (/ETIMEDOUT|ESOCKETTIMEDOUT/.test(msg)) return 'Request timed out — the server took too long to respond'
  if (/ECONNRESET/.test(msg)) return 'Connection was reset by the server'
  if (/certificate|SSL|TLS/i.test(msg)) return 'SSL/TLS certificate error — the site may have an invalid certificate'
  return msg || 'Failed to fetch page'
}

export default defineEventHandler(async (event) => {
  const { runPageAudit } = _require(join(process.cwd(), 'utils/auditRunner.js'))
  const { calcAllCatScores, buildJsonOutput } = _require(join(process.cwd(), 'utils/score.js'))
  const db = _require(join(process.cwd(), 'utils/db.js'))

  const body = await readBody(event)
  const { urls } = body ?? {}

  if (!Array.isArray(urls) || urls.length === 0) {
    throw createError({ statusCode: 400, message: 'urls array is required' })
  }

  const tier = event.context.tier
  const limit: number = tier?.bulkAuditLimit ?? 10
  const plan: string = event.context.plan ?? 'anon'
  const userId: number | null = event.context.userId ?? null
  const urlList: string[] = urls.slice(0, limit).filter(u => typeof u === 'string' && u.trim())

  const audits: any[] = useNitroApp().bulkAudits ?? useNitroApp().audits ?? []

  // Disable Nagle's algorithm — without this, rapid SSE writes get batched on Windows
  try { event.node.res.socket?.setNoDelay(true) } catch {}

  const stream = createEventStream(event)

  ;(async () => {
    // Yield to let stream.send() complete before first push
    await new Promise(resolve => setTimeout(resolve, 0))

    const results: any[] = []

    for (let i = 0; i < urlList.length; i++) {
      const url = urlList[i].trim()
      await stream.push(JSON.stringify({ type: 'progress', current: i + 1, total: urlList.length, url }))

      try {
        const { results: auditResults, score, grade } = await runPageAudit(url, audits)
        const failCount  = auditResults.filter((r: any) => r.status === 'fail').length
        const warnCount  = auditResults.filter((r: any) => r.status === 'warn').length
        const passCount  = auditResults.filter((r: any) => r.status === 'pass').length
        const topIssues  = auditResults
          .filter((r: any) => r.status === 'fail')
          .slice(0, 3)
          .map((r: any) => r.name.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, ''))
        const catScores = calcAllCatScores(auditResults)

        let reportId: number | null = null
        if (db && userId) {
          const { results: jsonResults } = buildJsonOutput(url, auditResults, score, grade)
          try {
            const [row] = await db('reports').insert({
              user_id: userId, url, audit_type: 'page', score, grade,
              results_json: JSON.stringify(jsonResults),
              cat_scores_json: JSON.stringify(catScores),
            }).returning('id')
            reportId = row?.id ?? null
          } catch (err: any) {
            console.error('[bulk-audit] DB insert failed:', err.message)
          }
        }

        const result = { type: 'result', url, score, grade, failCount, warnCount, passCount, topIssues, catScores, reportId, error: null }
        results.push(result)
        await stream.push(JSON.stringify(result))
      } catch (err: any) {
        const result = { type: 'result', url, score: null, grade: null, failCount: 0, warnCount: 0, passCount: 0, topIssues: [], catScores: null, reportId: null, error: friendlyError(err.message || '') }
        results.push(result)
        await stream.push(JSON.stringify(result))
      }
    }

    // AI triage summary (pro/agency, requires GROQ_API_KEY)
    let aiTriage: any = null
    if (process.env.GROQ_API_KEY && (plan === 'pro' || plan === 'agency') && results.length > 0) {
      try {
        const { callGemini } = _require(join(process.cwd(), 'utils/gemini.js'))
        const successful = results.filter((r: any) => !r.error)
        if (successful.length > 0) {
          const batchContext = successful
            .map((r: any) => `URL: ${r.url} | Score: ${r.score ?? 'N/A'}/100 | Fails: ${r.failCount} | Issues: ${r.topIssues.join(', ') || 'none'}`)
            .join('\n')
          const raw = await callGemini(
            'You are an SEO consultant reviewing a batch of page audits. Return ONLY a JSON object, no other text.\n' +
            'Schema: { "headline": "1 sentence summarizing overall batch health", "criticalUrls": [{ "url": "...", "reason": "8 words max — main problem" }], "commonIssue": "most widespread problem across the batch in 6 words max", "quickWin": { "url": "...", "action": "8-word fix for the easiest win" } }\n' +
            'criticalUrls: top 2-3 URLs with most failures. quickWin: the URL closest to a good score with one clear fix.',
            `Batch of ${successful.length} URLs:\n${batchContext}`,
            300,
          )
          const jsonMatch = raw.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            try { aiTriage = JSON.parse(jsonMatch[0]) } catch {}
          }
        }
      } catch {}
    }

    await stream.push(JSON.stringify({ type: 'done', aiTriage }))
    await stream.close()
  })().catch(async () => { try { await stream.close() } catch {} })

  return stream.send()
})
