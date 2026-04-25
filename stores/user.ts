import { defineStore } from 'pinia'

interface UserLimits {
  crawlPageLimit: number
  multiAuditLimit: number
  rateLimit: { windowMs: number; max: number }
}

interface User {
  id: number
  name: string
  email: string
  avatar_url: string
  plan: string
}

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as User | null,
    limits: null as UserLimits | null,
    loaded: false,
  }),
  getters: {
    isLoggedIn: (state) => !!state.user,
    plan: (state) => state.user?.plan ?? 'anon',
    crawlPageLimit: (state) => state.limits?.crawlPageLimit ?? 10,
    multiAuditLimit: (state) => state.limits?.multiAuditLimit ?? 3,
  },
  actions: {
    async fetchMe() {
      try {
        const data = await $fetch<{ user: User | null; limits: UserLimits }>('/api/me')
        this.user = data.user
        this.limits = data.limits
      } catch {
        this.user = null
        this.limits = null
      } finally {
        this.loaded = true
      }
    },
  },
})
