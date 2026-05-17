import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const sessionUser = (session as any)?.user ?? null
  if (!sessionUser) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const db = _require(join(process.cwd(), 'utils/db.js'))
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const { domain } = getQuery(event)
  if (!domain || typeof domain !== 'string') throw createError({ statusCode: 400, message: 'domain required' })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  // Return raw scans for the last 90 days, newest last
  const scans = await db('ai_visibility_scans')
    .where({ user_id: sessionUser.id, domain })
    .where('created_at', '>=', cutoff.toISOString())
    .orderBy('created_at', 'asc')
    .select('query', 'query_category', 'inferred_category', 'platform', 'mentioned', 'sentiment', 'excerpt', 'created_at')

  // Group by week for sparkline
  const weekMap: Record<string, { total: number; mentioned: number }> = {}
  for (const s of scans) {
    const d = new Date(s.created_at)
    // ISO week start (Monday)
    const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1)
    const week = d.toISOString().slice(0, 10)
    if (!weekMap[week]) weekMap[week] = { total: 0, mentioned: 0 }
    weekMap[week].total++
    if (s.mentioned) weekMap[week].mentioned++
  }

  const weekly = Object.entries(weekMap).map(([week, v]) => ({
    week,
    mentionRate: v.total > 0 ? Math.round((v.mentioned / v.total) * 100) : 0,
    total: v.total,
  }))

  // Derive latestScan: get the most recent 10 rows per platform
  const SCAN_BATCH_SIZE = 10
  let latestScan = null
  if (scans.length > 0) {
    // Find distinct platforms present in scans
    const platformSet = [...new Set(scans.map((s: any) => s.platform as string))]

    // For each platform, take its last SCAN_BATCH_SIZE rows (scans are asc, so slice from end)
    const byPlatformScans: Record<string, any[]> = {}
    for (const plat of platformSet) {
      const platScans = scans.filter((s: any) => s.platform === plat)
      byPlatformScans[plat] = platScans.slice(-SCAN_BATCH_SIZE)
    }

    const pct = (arr: any[]) => arr.length === 0 ? null : Math.round((arr.filter((s: any) => s.mentioned).length / arr.length) * 100)

    // Per-platform scores
    const platformScores: Record<string, any> = {}
    const PLATFORM_LABELS: Record<string, string> = {
      groq: 'LLaMA (Groq)', openai: 'GPT-4o-mini', perplexity: 'Perplexity',
    }
    for (const plat of platformSet) {
      const platScans = byPlatformScans[plat]
      platformScores[plat] = {
        mentionRate: pct(platScans) ?? 0,
        label: PLATFORM_LABELS[plat] ?? plat,
        categoryScores: {
          awareness:      pct(platScans.filter((s: any) => s.query_category === 'awareness')),
          discovery:      pct(platScans.filter((s: any) => s.query_category === 'discovery')),
          recommendation: pct(platScans.filter((s: any) => s.query_category === 'recommendation')),
        },
      }
    }

    // All scans from the latest batch (all platforms combined)
    const allBatchScans = Object.values(byPlatformScans).flat()
    const mentionRate = Math.round(
      platformSet.reduce((sum, p) => sum + platformScores[p].mentionRate, 0) / platformSet.length
    )

    latestScan = {
      scans: allBatchScans.map(({ query, query_category, mentioned, sentiment, excerpt, platform: p }: any) => ({
        query, query_category, mentioned, sentiment, excerpt, platform: p,
      })),
      mentionRate,
      categoryScores: {
        awareness:      pct(allBatchScans.filter((s: any) => s.query_category === 'awareness')),
        discovery:      pct(allBatchScans.filter((s: any) => s.query_category === 'discovery')),
        recommendation: pct(allBatchScans.filter((s: any) => s.query_category === 'recommendation')),
      },
      platformScores,
      inferredCategory: allBatchScans.find((s: any) => s.inferred_category)?.inferred_category ?? null,
      platforms: platformSet,
    }
  }

  return { scans, weekly, latestScan }
})
