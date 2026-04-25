import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user: googleUser }) {
    const db = _require(join(process.cwd(), 'utils/db.js'))

    if (!db) {
      await setUserSession(event, {
        user: { id: 0, name: googleUser.name, email: googleUser.email, avatar_url: googleUser.picture, plan: 'free' },
      })
      return sendRedirect(event, '/dashboard')
    }

    const existing = await db('users').where({ google_id: googleUser.sub }).first()
    let userId: number

    if (existing) {
      await db('users')
        .where({ google_id: googleUser.sub })
        .update({ name: googleUser.name, email: googleUser.email, avatar_url: googleUser.picture })
      userId = existing.id
    } else {
      const [newUser] = await db('users')
        .insert({ google_id: googleUser.sub, name: googleUser.name, email: googleUser.email, avatar_url: googleUser.picture })
        .returning(['id'])
      userId = newUser.id
    }

    const dbUser = await db('users').where({ id: userId }).first()
    await setUserSession(event, {
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        avatar_url: dbUser.avatar_url,
        plan: dbUser.plan || 'free',
      },
    })

    return sendRedirect(event, '/dashboard')
  },
  onError(event, error) {
    console.error('Google OAuth error:', error)
    return sendRedirect(event, '/?auth_error=1')
  },
})
