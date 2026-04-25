import { createRequire } from 'module'
import { join, basename } from 'path'

const _require = createRequire(import.meta.url)

function classifyFetchError(err: any): string {
  const code = err.code || ''
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'dns_failed'
  if (code === 'ECONNREFUSED') return 'connection_refused'
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') return 'timeout'
  if (code.startsWith('CERT_') || code.startsWith('ERR_TLS') || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') return 'ssl_error'
  if (err.response?.status >= 400) return 'http_error'
  return 'fetch_failed'
}

function fetchErrorMessage(errorCode: string, url: string): string {
  let host = url
  try { host = new URL(url).hostname } catch {}
  switch (errorCode) {
    case 'dns_failed':         return `Could not reach ${host}. Check the URL is correct and the site is live.`
    case 'connection_refused': return `Connection refused by ${host}. The server may be blocking automated requests.`
    case 'timeout':            return `Request to ${host} timed out. The server may be slow or unavailable.`
    case 'ssl_error':          return `SSL certificate error on ${host}. The site's HTTPS certificate may be expired or invalid.`
    case 'http_error':         return `${host} returned an error response. The page may require login or may not exist.`
    default:                   return `Could not fetch ${host}. Verify the URL is publicly accessible.`
  }
}

export default defineEventHandler(async (event) => {
  const { fetchPage }   = _require(join(process.cwd(), 'utils/fetcher.js'))
  const { calcTotalScore, letterGrade, buildJsonOutput } = _require(join(process.cwd(), 'utils/score.js'))
  const { generatePDF } = _require(join(process.cwd(), 'utils/generatePDF.js'))
  const db              = _require(join(process.cwd(), 'utils/db.js'))

  const body = await readBody(event)
  const { url, logoUrl } = body ?? {}
  if (!url) throw createError({ statusCode: 400, message: 'url is required' })

  let safeLogoUrl: string | null = null
  if (logoUrl && typeof logoUrl === 'string') {
    try {
      const parsed = new URL(logoUrl)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') safeLogoUrl = logoUrl
    } catch {}
  }

  const audits: any[] = useNitroApp().audits ?? []

  try {
    const { html, $, headers, finalUrl, responseTimeMs } = await fetchPage(url)
    const meta = { headers, finalUrl, responseTimeMs }
    const results = (
      await Promise.all(audits.map((a) => new Promise((resolve) => resolve(a($, html, url, meta))).catch(() => null)))
    ).flat().filter(Boolean)

    const score = calcTotalScore(results)
    const grade = letterGrade(score)
    const jsonOutput = buildJsonOutput(url, results, score, grade)
    const pdfPath = await generatePDF(jsonOutput, { logoUrl: safeLogoUrl })
    const pdfFile = basename(pdfPath)

    const userId = event.context.userId ?? null
    if (db && userId) {
      db('reports').insert({ user_id: userId, url, audit_type: 'page', score, grade, pdf_filename: pdfFile })
        .catch((err: any) => console.error('Failed to save report:', err.message))
    }

    return { ...jsonOutput, pdfFile }
  } catch (err: any) {
    const errorCode = classifyFetchError(err)
    throw createError({ statusCode: 502, message: fetchErrorMessage(errorCode, url), data: { errorCode } })
  }
})
