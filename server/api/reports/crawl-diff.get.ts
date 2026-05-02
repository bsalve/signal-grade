import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
  if (!user) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const db = _require(join(process.cwd(), 'utils/db.js'))
  if (!db) throw createError({ statusCode: 503, message: 'Database not available' })

  const { a, b } = getQuery(event)
  if (!a || !b) throw createError({ statusCode: 400, message: 'a and b report IDs are required' })

  const [reportA, reportB] = await Promise.all([
    db('reports').where({ id: Number(a), user_id: user.id }).whereNull('deleted_at').first(),
    db('reports').where({ id: Number(b), user_id: user.id }).whereNull('deleted_at').first(),
  ])

  if (!reportA) throw createError({ statusCode: 404, message: `Report ${a} not found` })
  if (!reportB) throw createError({ statusCode: 404, message: `Report ${b} not found` })

  const parse = (r: any) => {
    if (!r.results_json) return []
    try { return typeof r.results_json === 'string' ? JSON.parse(r.results_json) : r.results_json } catch { return [] }
  }

  const resultsA = parse(reportA)
  const resultsB = parse(reportB)

  const mapA: Record<string, any> = {}
  const mapB: Record<string, any> = {}
  for (const r of resultsA) mapA[r.name] = r
  for (const r of resultsB) mapB[r.name] = r

  const allNames = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])]

  const STATUS_RANK: Record<string, number> = { fail: 0, warn: 1, pass: 2 }
  const diff = allNames.map(name => {
    const ra = mapA[name]
    const rb = mapB[name]
    const statusA = ra?.status ?? null
    const statusB = rb?.status ?? null
    const scoreA  = ra?.normalizedScore ?? null
    const scoreB  = rb?.normalizedScore ?? null

    let change = 'unchanged'
    if (statusA && statusB) {
      const rankA = STATUS_RANK[statusA] ?? 1
      const rankB = STATUS_RANK[statusB] ?? 1
      if (rankB > rankA) change = 'improved'
      else if (rankB < rankA) change = 'regressed'
      else if (scoreA !== null && scoreB !== null) {
        if (scoreB - scoreA >= 10) change = 'improved'
        else if (scoreA - scoreB >= 10) change = 'regressed'
      }
    }

    return { name, statusA, statusB, scoreA, scoreB, change }
  }).sort((a, b) => {
    const order: Record<string, number> = { regressed: 0, improved: 1, unchanged: 2 }
    return (order[a.change] ?? 3) - (order[b.change] ?? 3)
  })

  return {
    reportA: { id: reportA.id, url: reportA.url, createdAt: reportA.created_at, score: reportA.score, grade: reportA.grade },
    reportB: { id: reportB.id, url: reportB.url, createdAt: reportB.created_at, score: reportB.score, grade: reportB.grade },
    diff,
  }
})
