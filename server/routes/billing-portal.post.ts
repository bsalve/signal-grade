import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) throw createError({ statusCode: 503, message: 'Payments not configured' })

  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
  if (!user?.id) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const db = _require(join(process.cwd(), 'utils/db.js'))
  if (!db) return sendRedirect(event, '/account')

  const dbUser = await db('users').where({ id: user.id }).first()
  if (!dbUser?.stripe_customer_id) return sendRedirect(event, '/account')

  const Stripe = _require('stripe')
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' })
  const baseUrl = process.env.APP_URL || 'http://localhost:3001'

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   dbUser.stripe_customer_id,
      return_url: `${baseUrl}/account`,
    })
    return sendRedirect(event, portalSession.url, 303)
  } catch (err: any) {
    console.error('Stripe billing portal error:', err.message)
    return sendRedirect(event, '/account')
  }
})
