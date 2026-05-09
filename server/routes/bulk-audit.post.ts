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

  const body = await readBody(event)
  const { urls } = body ?? {}

  if (!Array.isArray(urls) || urls.length === 0) {
    throw createError({ statusCode: 400, message: 'urls array is required' })
  }

  const tier = event.context.tier
  const limit: number = tier?.bulkAuditLimit ?? 10
  const urlList: string[] = urls.slice(0, limit).filter(u => typeof u === 'string' && u.trim())

  const audits: any[] = useNitroApp().audits ?? []

  const results = []
  for (const url of urlList) {
    try {
      const { results: auditResults, score, grade } = await runPageAudit(url.trim(), audits)
      const failCount  = auditResults.filter((r: any) => r.status === 'fail').length
      const warnCount  = auditResults.filter((r: any) => r.status === 'warn').length
      const passCount  = auditResults.filter((r: any) => r.status === 'pass').length
      const topIssues  = auditResults
        .filter((r: any) => r.status === 'fail')
        .slice(0, 3)
        .map((r: any) => r.name.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, ''))
      results.push({ url, score, grade, failCount, warnCount, passCount, topIssues, error: null })
    } catch (err: any) {
      results.push({ url, score: null, grade: null, failCount: 0, warnCount: 0, passCount: 0, topIssues: [], error: friendlyError(err.message || '') })
    }
  }

  // AI triage summary (pro/agency, requires GROQ_API_KEY)
  let aiTriage: any = null
  const plan: string = event.context.plan ?? 'anon'
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

  return { results, aiTriage }
})
