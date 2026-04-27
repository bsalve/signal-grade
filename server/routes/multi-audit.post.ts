import { createRequire } from 'module'
import { join, basename } from 'path'

const _require = createRequire(import.meta.url)

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
  const { fetchPage }   = _require(join(process.cwd(), 'utils/fetcher.js'))
  const { calcTotalScore, letterGrade, buildJsonOutput } = _require(join(process.cwd(), 'utils/score.js'))
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
      const { html, $, headers, finalUrl, responseTimeMs } = await fetchPage(url)
      const meta = { headers, finalUrl, responseTimeMs }
      const results = (await Promise.all(audits.map((a) => a($, html, url, meta)))).flat()
      const score = calcTotalScore(results)
      const grade = letterGrade(score)
      return { ...buildJsonOutput(url, results, score, grade), label }
    })
  )

  const locations = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? { ...r.value, nap: extractNAP(r.value.results) }
      : {
          url: validLocs[i].url, label: validLocs[i].label,
          error: (r as PromiseRejectedResult).reason?.message || 'Audit failed',
          results: [], totalScore: 0, grade: 'F', nap: { phone: null, address: null },
        }
  )

  let pdfFile: string | null = null
  let r2Key: string | null = null
  const successful = locations.filter((l) => !(l as any).error)
  const userId = event.context.userId ?? null

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
    }).catch((err: any) => console.error('Failed to save report:', err.message))
  }

  return { locations, pdfFile }
})
