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

  // Derive latestScan from the last SCAN_BATCH_SIZE rows (one per query per scan run).
  // 10 queries = one full scan batch in the new design.
  const SCAN_BATCH_SIZE = 10
  let latestScan = null
  if (scans.length > 0) {
    const batchScans = scans.slice(-SCAN_BATCH_SIZE)
    const mentionCount = batchScans.filter((s: any) => s.mentioned).length
    const mentionRate = Math.round((mentionCount / batchScans.length) * 100)
    const platform = batchScans[batchScans.length - 1]?.platform ?? 'groq'

    // Compute category sub-scores
    const byCategory = (cat: string) => batchScans.filter((s: any) => s.query_category === cat)
    const pct = (arr: any[]) => arr.length === 0 ? null : Math.round((arr.filter((s: any) => s.mentioned).length / arr.length) * 100)

    const awareness      = byCategory('awareness')
    const discovery      = byCategory('discovery')
    const recommendation = byCategory('recommendation')

    latestScan = {
      scans: batchScans.map(({ query, query_category, mentioned, sentiment, excerpt, platform: p }: any) => ({
        query, query_category, mentioned, sentiment, excerpt, platform: p,
      })),
      mentionRate,
      categoryScores: {
        awareness:      pct(awareness),
        discovery:      pct(discovery),
        recommendation: pct(recommendation),
      },
      inferredCategory: batchScans.find((s: any) => s.inferred_category)?.inferred_category ?? null,
      platforms: [platform],
    }
  }

  return { scans, weekly, latestScan }
})
