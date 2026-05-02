import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const { fetchPage } = _require(join(process.cwd(), 'utils/fetcher.js'))
  const { calcTotalScore, letterGrade } = _require(join(process.cwd(), 'utils/score.js'))

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
      const { html, $, headers, finalUrl, responseTimeMs } = await fetchPage(url.trim())
      const meta = { headers, finalUrl, responseTimeMs }
      const auditResults = (
        await Promise.all(audits.map((a) => new Promise((resolve) => resolve(a($, html, url, meta))).catch(() => null)))
      ).flat().filter(Boolean)
      const score = calcTotalScore(auditResults)
      const grade = letterGrade(score)
      const failCount  = auditResults.filter((r: any) => r.status === 'fail').length
      const warnCount  = auditResults.filter((r: any) => r.status === 'warn').length
      const passCount  = auditResults.filter((r: any) => r.status === 'pass').length
      const topIssues  = auditResults
        .filter((r: any) => r.status === 'fail')
        .slice(0, 3)
        .map((r: any) => r.name.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, ''))
      results.push({ url, score, grade, failCount, warnCount, passCount, topIssues, error: null })
    } catch (err: any) {
      results.push({ url, score: null, grade: null, failCount: 0, warnCount: 0, passCount: 0, topIssues: [], error: err.message || 'Failed to fetch page' })
    }
  }

  return { results }
})
