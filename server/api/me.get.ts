import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)
const { getTier, ANON_RATE_LIMIT } = _require(join(process.cwd(), 'utils/tiers.js'))

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
  const tier = user ? getTier(user) : null

  return {
    user,
    limits: {
      crawlPageLimit: tier?.crawlPageLimit ?? 10,
      multiAuditLimit: tier?.multiAuditLimit ?? 3,
      rateLimit: tier?.rateLimit ?? ANON_RATE_LIMIT,
    },
  }
})
