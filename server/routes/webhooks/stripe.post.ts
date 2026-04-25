import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !webhookSecret) {
    throw createError({ statusCode: 503, message: 'Stripe not configured' })
  }

  const db = _require(join(process.cwd(), 'utils/db.js'))
  const Stripe = _require('stripe')
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' })

  const rawBody = await readRawBody(event)
  const sig = getHeader(event, 'stripe-signature')

  let stripeEvent: any
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err: any) {
    throw createError({ statusCode: 400, message: `Webhook signature error: ${err.message}` })
  }

  if (!db) return { received: true }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const sess = stripeEvent.data.object
      const userId = parseInt(sess.metadata?.user_id, 10)
      const plan = sess.metadata?.plan || 'pro'
      if (userId) {
        await db('users').where({ id: userId }).update({
          plan,
          stripe_customer_id: sess.customer,
          stripe_subscription_id: sess.subscription,
          stripe_subscription_status: 'active',
        })
      }
    } else if (stripeEvent.type === 'customer.subscription.updated') {
      const sub = stripeEvent.data.object
      await db('users').where({ stripe_customer_id: sub.customer }).update({
        stripe_subscription_id: sub.id,
        stripe_subscription_status: sub.status,
      })
    } else if (stripeEvent.type === 'customer.subscription.deleted') {
      const sub = stripeEvent.data.object
      await db('users').where({ stripe_customer_id: sub.customer }).update({
        plan: 'free',
        stripe_subscription_id: null,
        stripe_subscription_status: 'canceled',
      })
    }
  } catch (err: any) {
    console.error('Stripe webhook DB error:', err.message)
  }

  return { received: true }
})
