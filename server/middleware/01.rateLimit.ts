import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)
const { getTier, ANON_RATE_LIMIT } = _require(join(process.cwd(), 'utils/tiers.js'))

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const RATE_LIMITED_PREFIXES = ['/audit', '/multi-audit', '/crawl']

export default defineEventHandler(async (event) => {
  const path = event.path ?? ''

  if (!RATE_LIMITED_PREFIXES.some(prefix => path.startsWith(prefix))) return
  if (path.startsWith('/webhooks/')) return

  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
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

  if (entry.count > limits.max) {
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
