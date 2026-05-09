import { createRequire } from 'module'
import { join, basename } from 'path'

const _require = createRequire(import.meta.url)

function friendlyError(msg: string): string {
  if (/ENOTFOUND|ECONNREFUSED|EAI_AGAIN/.test(msg)) return 'Could not reach this URL — check the domain is correct and the site is live'
  if (/ETIMEDOUT|ESOCKETTIMEDOUT/.test(msg)) return 'Request timed out — the server took too long to respond'
  if (/ECONNRESET/.test(msg)) return 'Connection was reset by the server'
  if (/certificate|SSL|TLS/i.test(msg)) return 'SSL/TLS certificate error — the site may have an invalid certificate'
  return msg || 'Audit failed'
}

function extractNAP(results: any[]) {
  const napResult = (results || []).find((r: any) => r.name === '[Content] NAP Consistency')
  if (!napResult?.details) return { phone: null, address: null }
  const phoneMatch = napResult.details.match(/Phone:\s*"([^"]+)"/)
  const addrMatch  = napResult.details.match(/Address:\s*"([^"]+)"/)
  return {
    phone:   phoneMatch ? phoneMatch[1] : null,
    address: addrMatch  ? addrMatch[1]  : null,
  }
}

export default defineEventHandler(async (event) => {
  const { runPageAudit } = _require(join(process.cwd(), 'utils/auditRunner.js'))
  const { buildJsonOutput, letterGrade } = _require(join(process.cwd(), 'utils/score.js'))
  const { generateMultiPDF } = _require(join(process.cwd(), 'utils/generatePDF.js'))
  const db              = _require(join(process.cwd(), 'utils/db.js'))
  const r2              = _require(join(process.cwd(), 'utils/r2.js'))

  const body = await readBody(event)
  const tier = event.context.tier
  const plan = event.context.plan ?? 'anon'
  const maxUrls: number = tier?.multiAuditLimit ?? 3

  const inputLocs: Array<{ url: string; label: string }> = Array.isArray(body?.locations)
    ? body.locations
    : Array.isArray(body?.urls)
      ? body.urls.map((u: string) => ({ url: u, label: '' }))
      : []

  if (inputLocs.length === 0) throw createError({ statusCode: 400, message: 'urls or locations array is required' })
  if (inputLocs.length > maxUrls) {
    const upgradeMsg = plan === 'anon' || plan === 'free'
      ? ' Sign in and upgrade to Pro to compare up to 10 URLs.'
      : ''
    throw createError({ statusCode: 400, message: `Your plan allows up to ${maxUrls} URLs.${upgradeMsg}` })
  }

  const validLocs = inputLocs
    .map((l) => ({ url: (typeof l.url === 'string' ? l.url : '').trim(), label: (l.label || '').trim() }))
    .filter((l) => {
      try { const p = new URL(l.url); return p.protocol === 'http:' || p.protocol === 'https:' } catch { return false }
    })

  if (validLocs.length === 0) throw createError({ statusCode: 400, message: 'No valid http/https URLs provided' })

  const normalizedUrls = validLocs.map((l) => l.url.toLowerCase().replace(/\/+$/, ''))
  if (new Set(normalizedUrls).size !== validLocs.length) {
    throw createError({ statusCode: 400, message: 'Duplicate URLs are not allowed — each location must be unique' })
  }

  const audits: any[] = useNitroApp().audits ?? []

  const settled = await Promise.allSettled(
    validLocs.map(async ({ url, label }) => {
      const { results, score, grade } = await runPageAudit(url, audits)
      return { ...buildJsonOutput(url, results, score, grade), label }
    })
  )

  const locations = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? { ...r.value, nap: extractNAP(r.value.results) }
      : {
          url: validLocs[i].url, label: validLocs[i].label,
          error: friendlyError((r as PromiseRejectedResult).reason?.message || ''),
          results: [], totalScore: 0, grade: 'F', nap: { phone: null, address: null },
        }
  )

  const successful = locations.filter((l) => !(l as any).error)
  const userId = event.context.userId ?? null

  // AI comparison insight (pro/agency, requires GROQ_API_KEY)
  let comparisonInsight: any = null
  if (process.env.GROQ_API_KEY && (plan === 'pro' || plan === 'agency') && successful.length >= 2) {
    try {
      const { callGemini } = _require(join(process.cwd(), 'utils/gemini.js'))
      const allCheckNames = new Set<string>(
        successful.flatMap((l: any) => (l.results || []).map((r: any) => r.name))
      )
      const sharedFailNames = [...allCheckNames].filter(name =>
        successful.every((l: any) => (l.results || []).find((r: any) => r.name === name)?.status === 'fail')
      ).slice(0, 5)
      const locationContext = successful.map((l: any) => {
        const fails = (l.results || []).filter((r: any) => r.status === 'fail').slice(0, 4)
          .map((r: any) => r.name.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, ''))
        return `URL: ${l.url} | Score: ${l.totalScore}/100 (${l.grade}) | Top fails: ${fails.join(', ') || 'none'}`
      }).join('\n')
      const raw = await callGemini(
        'You are an SEO consultant comparing multiple locations or competitors. Return ONLY a JSON object, no other text.\n' +
        'Schema: { "winner": { "url": "...", "reason": "8 words max why they score highest" }, "sharedIssues": [{ "name": "check name", "area": "Technical|Content|AEO|GEO", "impact": "high|medium|low" }], "differentiators": [{ "url": "...", "advantage": "8 words max" }], "quickWin": "one actionable sentence applicable to all locations" }\n' +
        'sharedIssues: up to 3 issues ALL locations fail. differentiators: up to 2 things separating winner from others. impact must be high, medium, or low.',
        `Comparing ${successful.length} locations:\n${locationContext}\n\nKnown shared failures: ${sharedFailNames.join(', ') || 'none'}`,
        350,
      )
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try { comparisonInsight = JSON.parse(jsonMatch[0]) } catch {}
      }
    } catch {}
  }

  let pdfFile: string | null = null
  let r2Key: string | null = null

  if (successful.length > 0) {
    try {
      const pdfPath = await generateMultiPDF(successful)
      pdfFile = basename(pdfPath)
      if (r2.isConfigured() && userId) {
        r2Key = `reports/${userId}/${pdfFile}`
        await r2.uploadPDF(pdfPath, r2Key)
        // Local file kept as cache for the homepage download button
      }
    } catch (e: any) {
      console.error('Multi-audit PDF generation or upload failed:', e.message)
      r2Key = null
    }
  }

  const avgScore = successful.length
    ? Math.round(successful.reduce((s: number, l: any) => s + l.totalScore, 0) / successful.length)
    : null
  if (db && userId) {
    await db('reports').insert({
      user_id:      userId,
      url:          validLocs[0].url,
      audit_type:   'multi',
      score:        avgScore,
      grade:        avgScore !== null ? letterGrade(avgScore) : null,
      pdf_filename: pdfFile,
      r2_key:       r2Key,
      locations:    JSON.stringify(successful.map((l: any) => ({ url: l.url, label: l.label || '', score: l.totalScore, grade: l.grade }))),
      results_json: JSON.stringify(successful.flatMap((l: any) => l.results || [])),
      meta_json:    JSON.stringify({ locations: successful }),
      ai_recs_json: comparisonInsight ? JSON.stringify({ __comparison_insight__: comparisonInsight }) : null,
    }).catch((err: any) => console.error('Failed to save report:', err.message))
  }

  return { locations, pdfFile, comparisonInsight }
})
