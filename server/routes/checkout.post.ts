import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  pro:    process.env.STRIPE_PRO_PRICE_ID,
  agency: process.env.STRIPE_AGENCY_PRICE_ID,
}

export default defineEventHandler(async (event) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) throw createError({ statusCode: 503, message: 'Payments not configured' })

  const session = await getUserSession(event)
  const user = (session as any)?.user ?? null
  if (!user?.id) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const body = await readBody(event)
  const plan: string = body?.plan
  const priceId = PLAN_PRICE_IDS[plan]
  if (!priceId) throw createError({ statusCode: 400, message: 'Invalid plan' })

  const Stripe = _require('stripe')
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' })
  const baseUrl = process.env.APP_URL || 'http://localhost:3001'

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode:                 'subscription',
      payment_method_types: ['card'],
      customer_email:       user.email || undefined,
      line_items:           [{ price: priceId, quantity: 1 }],
      metadata:             { user_id: String(user.id), plan },
      success_url:          `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:           `${baseUrl}/account`,
    })
    return sendRedirect(event, checkoutSession.url!, 303)
  } catch (err: any) {
    console.error('Stripe checkout error:', err.message)
    throw createError({ statusCode: 500, message: 'Could not create checkout session' })
  }
})
