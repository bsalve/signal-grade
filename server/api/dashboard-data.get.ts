import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)
const db = _require(join(process.cwd(), 'utils/db.js'))

function gradeColor(score: number): string {
  if (score >= 90) return '#34d399'
  if (score >= 80) return '#4d9fff'
  if (score >= 70) return '#ffb800'
  if (score >= 60) return '#ff8800'
  return '#ff4455'
}

const TYPE_LABELS: Record<string, string> = { page: 'Page', site: 'Site', multi: 'Compare' }
const TYPE_COLORS: Record<string, string> = { page: '#8892a4', site: '#7baeff', multi: '#b07bff' }

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
  if (!user) throw createError({ statusCode: 401, message: 'Not authenticated' })
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const rawReports = await db('reports')
    .where({ user_id: user.id })
    .whereNull('deleted_at')
    .orderBy('created_at', 'desc')
    .limit(100)
    .select('id', 'user_id', 'url', 'audit_type', 'score', 'grade', 'pdf_filename', 'r2_key', 'created_at', 'share_token', 'cat_scores_json', 'locations',
      db.raw('(results_json IS NOT NULL) AS has_results')
    )

  // Compute score delta for each report vs the previous same-domain same-type audit
  const domainTypeSeq: Record<string, number | null> = {}
  const scoreDeltaMap: Record<number, number | null> = {}
  // rawReports is newest-first; iterate in reverse to build previous-score map
  for (let i = rawReports.length - 1; i >= 0; i--) {
    const r = rawReports[i]
    let host = r.url
    try { host = new URL(r.url).hostname } catch {}
    const key = `${host}::${r.audit_type}`
    const prevScore = domainTypeSeq[key] ?? null
    scoreDeltaMap[r.id] = (prevScore !== null && r.score !== null) ? r.score - prevScore : null
    domainTypeSeq[key] = r.score
  }

  const reports = rawReports.map((r: any) => ({
    ...r,
    gradeColor:    gradeColor(r.score || 0),
    typeLabel:     TYPE_LABELS[r.audit_type] || r.audit_type,
    typeColor:     TYPE_COLORS[r.audit_type] || '#8892a4',
    dateFormatted: new Date(r.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }),
    scoreDelta: scoreDeltaMap[r.id] ?? null,
    catScores: r.cat_scores_json
      ? (typeof r.cat_scores_json === 'string' ? JSON.parse(r.cat_scores_json) : r.cat_scores_json)
      : null,
    parsedLocations: r.locations
      ? (() => { try { return typeof r.locations === 'string' ? JSON.parse(r.locations) : r.locations } catch { return null } })()
      : null,
  }))

  // Crawl diff groups: domains with ≥2 site audit reports
  const siteGroupsMap: Record<string, any[]> = {}
  for (const r of rawReports) {
    if (r.audit_type !== 'site') continue
    let host = r.url
    try { host = new URL(r.url).hostname } catch {}
    if (!siteGroupsMap[host]) siteGroupsMap[host] = []
    siteGroupsMap[host].push(r)
  }
  const siteDiffGroups = Object.entries(siteGroupsMap)
    .filter(([, items]) => items.length >= 2)
    .map(([host, items]) => ({ host, idA: items[1].id, idB: items[0].id }))

  return { user, reports, reportCount: reports.length, hasReports: reports.length > 0, siteDiffGroups }
})
