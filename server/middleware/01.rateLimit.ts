import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)
const { getTier, ANON_RATE_LIMIT } = _require(join(process.cwd(), 'utils/tiers.js'))

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const RATE_LIMITED_PREFIXES = ['/audit', '/multi-audit', '/crawl', '/bulk-audit']

export default defineEventHandler(async (event) => {
  const path = event.path ?? ''

  if (!RATE_LIMITED_PREFIXES.some(prefix => path.startsWith(prefix))) return
  if (path.startsWith('/webhooks/')) return

  const session = await getUserSession(event)
  const user = (session as any)?.user ?? (event.context.apiKeyUser ?? null)
  const tier = getTier(user)
  const limits: { windowMs: number; max: number } = user && tier ? tier.rateLimit : ANON_RATE_LIMIT

  const key: string = user ? `user:${user.id}` : (getRequestIP(event, { xForwardedFor: true }) ?? 'unknown')
  const now = Date.now()
  const entry = store.get(key) ?? { count: 0, resetAt: now + limits.windowMs }

  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + limits.windowMs
  }
  entry.count++
  store.set(key, entry)

  setHeader(event, 'X-RateLimit-Limit', String(limits.max))
  setHeader(event, 'X-RateLimit-Remaining', String(Math.max(0, limits.max - entry.count)))
  setHeader(event, 'X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

  if (entry.count > limits.max) {
    setHeader(event, 'Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
    throw createError({
      statusCode: 429,
      message: 'Rate limit exceeded. Upgrade your plan for higher limits.',
      data: { code: 'rate_limited' },
    })
  }

  event.context.tier = tier
  event.context.plan = user ? (user.plan || 'free') : 'anon'
  event.context.userId = user?.id ?? null
})
