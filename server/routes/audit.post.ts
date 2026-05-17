import { createEventStream } from 'h3'
import { createRequire } from 'module'
import { join, basename } from 'path'

const _require = createRequire(import.meta.url)

function classifyFetchError(err: any): string {
  const code = err.code || ''
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'dns_failed'
  if (code === 'ECONNREFUSED') return 'connection_refused'
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') return 'timeout'
  if (code.startsWith('CERT_') || code.startsWith('ERR_TLS') || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') return 'ssl_error'
  const status = err.response?.status
  if (status === 401 || status === 403) return 'auth_required'
  if (status === 404) return 'not_found'
  if (status >= 500) return 'server_error'
  if (status >= 400) return 'http_error'
  return 'fetch_failed'
}

function fetchErrorMessage(errorCode: string, url: string): string {
  let host = url
  try { host = new URL(url).hostname } catch {}
  switch (errorCode) {
    case 'dns_failed':         return `${host} could not be reached. Check that the URL is correct and the site is live.`
    case 'connection_refused': return `${host} refused the connection. The server may be blocking automated requests.`
    case 'timeout':            return `${host} did not respond in time. The server may be slow or temporarily unavailable.`
    case 'ssl_error':          return `${host} has an SSL/TLS certificate error. The certificate may be expired or misconfigured.`
    case 'auth_required':      return `${host} requires a login. Only publicly accessible pages can be audited.`
    case 'not_found':          return `Page not found on ${host} (404). Check that the URL is correct.`
    case 'server_error':       return `${host} returned a server error. The site may be experiencing issues.`
    case 'http_error':         return `${host} returned an unexpected error. Check that the URL is publicly accessible.`
    default:                   return `Could not fetch ${host}. Check that the URL is correct and publicly accessible.`
  }
}

export default defineEventHandler(async (event) => {
  const { runPageAudit } = _require(join(process.cwd(), 'utils/auditRunner.js'))
  const { buildJsonOutput, calcAllCatScores } = _require(join(process.cwd(), 'utils/score.js'))
  const { generatePDF } = _require(join(process.cwd(), 'utils/generatePDF.js'))
  const db              = _require(join(process.cwd(), 'utils/db.js'))
  const email           = _require(join(process.cwd(), 'utils/email.js'))
  const { dispatchWebhooks } = _require(join(process.cwd(), 'utils/webhooks.js'))
  const r2 = _require(join(process.cwd(), 'utils/r2.js'))

  const body = await readBody(event)
  const { url, logoUrl, jsRender, perfBudget: rawPerfBudget } = body ?? {}
  if (!url) throw createError({ statusCode: 400, message: 'url is required' })

  let safeLogoUrl: string | null = null
  if (logoUrl && typeof logoUrl === 'string') {
    try {
      const parsed = new URL(logoUrl)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') safeLogoUrl = logoUrl
    } catch {}
  }

  const audits: any[] = useNitroApp().audits ?? []
  const plan = event.context.plan ?? 'anon'
  const userId = event.context.userId ?? null

  // Fall back to stored pdf_logo_url if no logo provided in request
  if (!safeLogoUrl && userId && db) {
    try {
      const dbUser = await db('users').where({ id: userId }).first()
      if (dbUser?.pdf_logo_url) safeLogoUrl = dbUser.pdf_logo_url
    } catch {}
  }

  // Disable Nagle's algorithm so each SSE progress event is flushed immediately
  // (without this, 100+ rapid writes get batched into a single TCP packet on Windows)
  try { event.node.res.socket?.setNoDelay(true) } catch {}

  const stream = createEventStream(event)
  const send = (obj: object) => stream.push(JSON.stringify(obj))

  ;(async () => {
    try {
      const useJsRender = jsRender === true && (plan === 'pro' || plan === 'agency')
      const isPro = plan === 'pro' || plan === 'agency'
      // Only allow perfBudget for pro/agency users; validate and clamp values
      const perfBudget = isPro && rawPerfBudget && typeof rawPerfBudget === 'object' ? {
        maxLcp:      Math.min(Math.max(Number(rawPerfBudget.maxLcp)      || 2500, 500),  10000),
        maxTbt:      Math.min(Math.max(Number(rawPerfBudget.maxTbt)      || 200,  50),   5000),
        maxJsKb:     Math.min(Math.max(Number(rawPerfBudget.maxJsKb)     || 500,  50),   5000),
        maxWeightKb: Math.min(Math.max(Number(rawPerfBudget.maxWeightKb) || 3000, 100),  20000),
      } : null
      const { results, score, grade } = await runPageAudit(url, audits, {
        jsRender: useJsRender,
        jsRenderTimeout: parseInt(process.env.JS_RENDER_TIMEOUT ?? '15000'),
        perfBudget,
        onProgress: ({ name, completed, total }: { name: string, completed: number, total: number }) => {
          send({ type: 'progress', check: name, completed, total })
        },
      })

      // Extract raw CWV values before buildJsonOutput strips extra fields
      const cwvRaw = results.find((r: any) => r.name === '[Technical] Core Web Vitals')?._cwvRaw ?? null

      const jsonOutput = buildJsonOutput(url, results, score, grade)

      // AI page summary generated before PDF so it can be embedded in the report
      let aiSummary: string | null = null
      let aiSummaryForPdf: string | null = null
      if (process.env.GROQ_API_KEY && (plan === 'pro' || plan === 'agency')) {
        try {
          const { callGemini } = _require(join(process.cwd(), 'utils/gemini.js'))
          const top5fails = jsonOutput.results
            .filter((r: any) => r.status === 'fail')
            .slice(0, 5)
            .map((r: any) => {
              const areaMatch = r.name.match(/^\[(Technical|Content|AEO|GEO)\]/)
              const area = areaMatch ? areaMatch[1] : 'Technical'
              const name = r.name.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, '')
              return `[${area}] ${name}: ${r.message || ''}`
            })
            .join('\n')
          const raw = await callGemini(
            'You are an SEO consultant. Return ONLY a JSON object, no other text.\n' +
            'Schema: { "verdict": "1-sentence overall assessment", "priority": "single most important fix in 8 words or fewer", "issues": [{ "area": "Technical|Content|AEO|GEO", "finding": "10 words max", "impact": "high|medium|low" }], "quickWin": "one actionable sentence" }\n' +
            'issues: exactly 3 items. impact must be high, medium, or low.',
            `URL: ${url}\nScore: ${score}/100 (${grade})\n\nTop failing checks:\n${top5fails || 'No failing checks.'}`,
            300,
          )
          const jsonMatch = raw.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0])
              aiSummary = JSON.stringify(parsed)
              aiSummaryForPdf = parsed.verdict || null
            } catch {
              aiSummary = raw
              aiSummaryForPdf = raw
            }
          } else {
            aiSummary = raw
            aiSummaryForPdf = raw
          }
        } catch (e: any) {
          console.error('[audit] AI summary failed:', e?.message ?? e)
        }
      }

      const pdfPath = await generatePDF(jsonOutput, { logoUrl: safeLogoUrl, aiSummary: aiSummaryForPdf })
      const pdfFile = basename(pdfPath)

      let r2Key: string | null = null
      if (r2.isConfigured() && userId) {
        try {
          r2Key = `reports/${userId}/${pdfFile}`
          await r2.uploadPDF(pdfPath, r2Key)
        } catch (e: any) {
          console.error('[audit] R2 upload failed:', e.message)
          r2Key = null
        }
      }

      let reportId: number | null = null
      if (db && userId) {
        const catScores = calcAllCatScores(jsonOutput.results)
        try {
          const [row] = await db('reports').insert({ user_id: userId, url, audit_type: 'page', score, grade, pdf_filename: pdfFile, r2_key: r2Key, results_json: JSON.stringify(jsonOutput.results), cat_scores_json: JSON.stringify(catScores), ai_summary: aiSummary }).returning('id')
          reportId = row?.id ?? null
        } catch (err: any) {
          console.error('[audit] DB insert failed:', err.message)
        }

        if (cwvRaw && (cwvRaw.lcpMs !== null || cwvRaw.cls !== null)) {
          db('cwv_history').insert({
            user_id: userId, url,
            lcp_ms: cwvRaw.lcpMs,
            tbt_ms: cwvRaw.tbtMs,
            cls:    cwvRaw.cls,
            performance_score: cwvRaw.perfScore,
          }).catch(() => {})
        }

        if (email.isConfigured()) {
          const session = await getUserSession(event)
          const sessionUser = (session as any)?.user ?? null
          if (sessionUser?.email) {
            db('reports')
              .where({ user_id: userId, url, audit_type: 'page' })
              .orderBy('created_at', 'desc')
              .offset(1).limit(1)
              .first()
              .then((prev: any) => {
                if (prev && prev.score !== null && score !== null && (prev.score - score) >= 10) {
                  const stripPrefix = (n: string) => n.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, '')
                  let regressionDiff: any = null
                  try {
                    const prevResults: any[] = prev.results_json
                      ? (typeof prev.results_json === 'string' ? JSON.parse(prev.results_json) : prev.results_json)
                      : []
                    const prevMap: Record<string, any> = {}
                    for (const r of prevResults) prevMap[r.name] = r
                    const newFailures = jsonOutput.results
                      .filter((r: any) => r.status === 'fail' && prevMap[r.name]?.status !== 'fail')
                      .slice(0, 5).map((r: any) => stripPrefix(r.name))
                    const newPasses = jsonOutput.results
                      .filter((r: any) => r.status === 'pass' && prevMap[r.name]?.status === 'fail')
                      .slice(0, 3).map((r: any) => stripPrefix(r.name))
                    const topDrops = jsonOutput.results
                      .filter((r: any) => prevMap[r.name] != null)
                      .map((r: any) => ({ name: r.name, from: prevMap[r.name].normalizedScore ?? 0, to: r.normalizedScore ?? 0 }))
                      .filter((d: any) => d.from - d.to > 0)
                      .sort((a: any, b: any) => (b.from - b.to) - (a.from - a.to))
                      .slice(0, 3).map((d: any) => ({ name: stripPrefix(d.name), from: d.from, to: d.to }))
                    regressionDiff = { newFailures, newPasses, topDrops }
                  } catch {}
                  email.sendRegressionAlert(sessionUser.email, sessionUser.name, url, prev.score, score, grade, regressionDiff)
                    .catch((e: any) => console.error('[email] regression alert failed:', e.message))
                }
              })
              .catch(() => {})
          }
        }
      }

      if (userId) dispatchWebhooks(userId, 'audit.complete', { url, score, grade, pdfFile }).catch(() => {})

      send({ type: 'done', ...jsonOutput, pdfFile, aiSummary, reportId })
    } catch (err: any) {
      const errorCode = classifyFetchError(err)
      send({ type: 'error', message: fetchErrorMessage(errorCode, url), errorCode })
    } finally {
      await stream.close()
    }
  })()

  return stream.send()
})
