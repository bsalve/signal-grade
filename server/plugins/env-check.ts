export default defineNitroPlugin(() => {
  const required = ['NUXT_SESSION_PASSWORD']
  const missing = required.filter(k => !process.env[k])
  if (missing.length) {
    console.error(`[SearchGrade] Missing required env vars: ${missing.join(', ')}`)
    process.exit(1)
  }

  const optional = ['DATABASE_URL', 'STRIPE_SECRET_KEY', 'RESEND_API_KEY']
  optional
    .filter(k => !process.env[k])
    .forEach(k => console.warn(`[SearchGrade] Warning: ${k} not set — related features will be disabled`))
})
