import { createEventStream } from 'h3'
import { createRequire } from 'module'
import { join, basename } from 'path'

const _require = createRequire(import.meta.url)

function transformSiteResultsForPDF(aggregated: any[], pageCount: number) {
  return aggregated.map((r) => {
    const total = r.fail.length + r.warn.length + r.pass.length || pageCount
    const status = r.fail.length > 0 ? 'fail' : r.warn.length > 0 ? 'warn' : 'pass'
    const normalizedScore = Math.round((r.pass.length + r.warn.length * 0.5) / total * 100)
    let details: string
    if (r.fail.length > 0) {
      details = `Failing on ${r.fail.length}/${pageCount} pages${r.warn.length > 0 ? `, warnings on ${r.warn.length} more` : ''}`
    } else if (r.warn.length > 0) {
      details = `Warnings on ${r.warn.length}/${pageCount} pages`
    } else {
      details = `Passing on all ${r.pass.length} crawled pages`
    }
    const pctFail = Math.round(r.fail.length / pageCount * 100)
    const pctWarn = Math.round(r.warn.length / pageCount * 100)
    const pctPass = 100 - pctFail - pctWarn
    return {
      name: r.name, status, normalizedScore, message: r.message || '', details,
      recommendation: r.recommendation || undefined,
      failCount: r.fail.length, warnCount: r.warn.length, passCount: r.pass.length,
      totalPages: pageCount, pctFail, pctWarn, pctPass,
    }
  })
}

export default defineEventHandler(async (event) => {
  const { crawlSite, aggregateResults }     = _require(join(process.cwd(), 'utils/crawler.js'))
  const { detectDuplicates, detectBodyDuplicates } = _require(join(process.cwd(), 'utils/detectDuplicates.js'))
  const { detectOrphans }                   = _require(join(process.cwd(), 'utils/detectOrphans.js'))
  const { detectClickDepth }                = _require(join(process.cwd(), 'utils/detectClickDepth.js'))
  const { detectCannibalization }           = _require(join(process.cwd(), 'utils/detectCannibalization.js'))
  const { detectThinContent }              = _require(join(process.cwd(), 'utils/detectThinContent.js'))
  const { detectSlowPages }               = _require(join(process.cwd(), 'utils/detectSlowPages.js'))
  const { letterGrade, gradeSummary }   = _require(join(process.cwd(), 'utils/score.js'))
  const { generatePDF }                 = _require(join(process.cwd(), 'utils/generatePDF.js'))
  const db                              = _require(join(process.cwd(), 'utils/db.js'))
  const r2                              = _require(join(process.cwd(), 'utils/r2.js'))
  const { dispatchWebhooks }            = _require(join(process.cwd(), 'utils/webhooks.js'))

  const { url: rawUrl } = getQuery(event)
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw createError({ statusCode: 400, message: 'url required' })
  }

  const tier = event.context.tier
  const plan: string = event.context.plan ?? 'anon'
  const maxPages: number = tier?.crawlPageLimit ?? 10
  const userId: number | null = event.context.userId ?? null

  const stream = createEventStream(event)

  ;(async () => {
    const send = (obj: object) => stream.push(JSON.stringify(obj))
    try {
      const pages = await crawlSite(rawUrl, {
        maxPages,
        onProgress: (evt: object) => send(evt),
      })

      const aggregated = aggregateResults(pages)
      aggregated.push(...detectDuplicates(pages))
      aggregated.push(...detectBodyDuplicates(pages))
      const orphanResults = detectOrphans(pages, rawUrl)
      aggregated.push(...orphanResults)
      const depthResults = detectClickDepth(pages)
      aggregated.push(...depthResults)
      aggregated.push(...detectCannibalization(pages))
      aggregated.push(...detectThinContent(pages))
      const slowResults = detectSlowPages(pages)
      aggregated.push(...slowResults)

      // Extract extra site-level data for the UI
      const depthDistribution: Record<number, number> = depthResults[0]?.depthDistribution || {}
      const linkEquity: Array<{url: string, inbound: number}> = orphanResults[0]?.linkEquity || []
      const responseStats = {
        avg: slowResults[0]?.avgResponseMs ?? null,
        p95: slowResults[0]?.p95ResponseMs ?? null,
        slowest: (slowResults[0]?.slowest ?? []) as Array<{url: string, ms: number}>,
      }

      // Directory structure: group pages by first path segment
      const dirCounts: Record<string, number> = {}
      for (const page of pages) {
        try {
          const seg = new URL(page.url).pathname.split('/').filter(Boolean)[0] || '(root)'
          dirCounts[seg] = (dirCounts[seg] || 0) + 1
        } catch {}
      }

      const transformed = transformSiteResultsForPDF(aggregated, pages.length)
      const siteScore = transformed.length
        ? Math.round(transformed.reduce((s: number, r: any) => s + r.normalizedScore, 0) / transformed.length)
        : 0
      const siteGrade = letterGrade(siteScore)

      // AI executive summary (pro/agency, requires GROQ_API_KEY)
      let aiSummary: string | null = null
      if (process.env.GROQ_API_KEY && (plan === 'pro' || plan === 'agency')) {
        try {
          const { callGemini } = _require(join(process.cwd(), 'utils/gemini.js'))
          const top5 = [...aggregated]
            .filter((r: any) => r.fail.length > 0)
            .sort((a: any, b: any) => b.fail.length - a.fail.length)
            .slice(0, 5)
            .map((r: any) => `${r.name.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, '')}: ${r.fail.length}/${pages.length} pages failing`)
            .join('\n')
          aiSummary = await callGemini(
            'You are an SEO consultant. Write a 3–5 sentence executive summary of these site audit results for an agency client report. Be specific about severity and impact. End with the single most important action to take first. Plain text only — no markdown, no asterisks, no bullet points, no headers.',
            `Site: ${rawUrl}\nPages crawled: ${pages.length}\nOverall score: ${siteScore}/100 (${siteGrade})\n\nTop issues:\n${top5 || 'No failing checks.'}`,
            200,
          )
        } catch {}
      }

      const pdfInput = {
        url: rawUrl,
        auditedAt:    new Date().toISOString(),
        totalScore:   siteScore,
        grade:        siteGrade,
        summary:      gradeSummary(siteGrade, siteScore),
        siteAuditLine: `Site audit · ${pages.length} page${pages.length !== 1 ? 's' : ''} crawled`,
        results:      transformed,
      }

      let pdfFile: string | null = null
      let r2Key: string | null = null
      try {
        const pdfPath = await generatePDF(pdfInput, { prefix: 'searchgrade-site', isSiteReport: true, pageCount: pages.length })
        pdfFile = basename(pdfPath)
        if (r2.isConfigured() && userId) {
          r2Key = `reports/${userId}/${pdfFile}`
          await r2.uploadPDF(pdfPath, r2Key)
          // Local file kept as cache for the homepage download button
        }
      } catch (e: any) {
        console.error('Site audit PDF generation or upload failed:', e.message)
        r2Key = null
      }

      if (db && userId) {
        const metaJson = JSON.stringify({ depthDistribution, dirCounts, linkEquity, responseStats, aiSummary })
        await db('reports').insert({ user_id: userId, url: rawUrl, audit_type: 'site', score: siteScore, grade: siteGrade, pdf_filename: pdfFile, r2_key: r2Key, results_json: JSON.stringify(transformed), meta_json: metaJson })
          .catch((err: any) => console.error('Failed to save report:', err.message))
      }

      if (userId) dispatchWebhooks(userId, 'site.complete', { url: rawUrl, pageCount: pages.length, score: siteScore, grade: siteGrade, pdfFile }).catch(() => {})

      send({ type: 'done', pageCount: pages.length, results: aggregated, pdfFile, depthDistribution, dirCounts, linkEquity, responseStats, aiSummary })
    } catch (err: any) {
      send({ type: 'error', message: err.message })
    } finally {
      await stream.close()
    }
  })()

  return stream.send()
})
