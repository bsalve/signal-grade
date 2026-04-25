<script setup>
definePageMeta({ middleware: 'auth' })
useHead({ title: 'Account — SignalGrade' })

const route = useRoute()
const upgraded = computed(() => route.query.upgraded === '1')

const { user } = useUserSession()

const TIERS = {
  free:   { crawlPageLimit: 10,  multiAuditLimit: 3,  rateLimit: { max: 10  } },
  pro:    { crawlPageLimit: 50,  multiAuditLimit: 10, rateLimit: { max: 60  } },
  agency: { crawlPageLimit: 200, multiAuditLimit: 10, rateLimit: { max: 200 } },
}
const PLAN_META = {
  free:   { label: 'Free',   color: '#8892a4' },
  pro:    { label: 'Pro',    color: '#4d9fff' },
  agency: { label: 'Agency', color: '#b07bff' },
}

const plan       = computed(() => user.value?.plan || 'free')
const tier       = computed(() => TIERS[plan.value] || TIERS.free)
const planMeta   = computed(() => PLAN_META[plan.value] || PLAN_META.free)
const planLabel  = computed(() => planMeta.value.label)
const planColor  = computed(() => planMeta.value.color)
const crawlLimit = computed(() => tier.value.crawlPageLimit)
const multiLimit = computed(() => tier.value.multiAuditLimit)
const rateLimit  = computed(() => tier.value.rateLimit.max)
const isAgency   = computed(() => plan.value === 'agency')

const hasBilling = ref(false)

onMounted(async () => {
  try {
    const d = await $fetch('/api/account-data')
    hasBilling.value = d.hasBilling ?? false
  } catch {}
})
</script>

<template>
  <div>
    <AppNav>
      <AppNavAuth>
        <a href="/pricing" class="nav-link">Pricing</a>
        <a href="/dashboard" class="nav-link">Dashboard</a>
        <a href="/account" class="nav-link nav-link-current">Account</a>
      </AppNavAuth>
    </AppNav>

    <div class="page">
      <div class="page-title">Account</div>

      <div v-if="upgraded" class="upgraded-notice">
        Payment received — your plan has been upgraded. It may take a moment to reflect below.
      </div>

      <!-- Profile -->
      <div class="card">
        <div class="card-title">Profile</div>
        <div class="profile-row">
          <img v-if="user?.avatar_url" :src="user.avatar_url" alt="" class="profile-avatar" referrerpolicy="no-referrer" />
          <div>
            <div class="profile-name">{{ user?.name }}</div>
            <div class="profile-email">{{ user?.email }}</div>
          </div>
        </div>
      </div>

      <!-- Current plan -->
      <div class="card">
        <div class="card-title">Plan</div>
        <div class="plan-row">
          <span
            class="plan-badge"
            :style="`color:${planColor};border:1px solid ${planColor}33;background:${planColor}11;box-shadow:0 0 12px ${planColor}22;`"
          >{{ planLabel }}</span>
          <form v-if="hasBilling" action="/billing-portal" method="POST" style="display:inline;">
            <button type="submit" class="btn-manage">Manage subscription</button>
          </form>
        </div>
        <div class="plan-limits">
          <div class="plan-limit-item">
            <strong>{{ crawlLimit }}</strong>
            <span>pages per site crawl</span>
          </div>
          <div class="plan-limit-item">
            <strong>{{ multiLimit }}</strong>
            <span>URLs per compare audit</span>
          </div>
          <div class="plan-limit-item">
            <strong>{{ rateLimit }}</strong>
            <span>audits per hour</span>
          </div>
        </div>
      </div>

      <!-- Upgrade -->
      <div v-if="!isAgency" class="card card-upgrade">
        <div class="card-title">Upgrade</div>
        <div class="upgrade-row">
          <div class="upgrade-copy">Higher crawl limits, more compare URLs, and faster auditing.</div>
          <a href="/pricing" class="btn-view-plans">View plans →</a>
        </div>
      </div>

      <!-- Sign out -->
      <div class="card">
        <div class="card-title">Session</div>
        <a href="/auth/logout" class="btn-signout">Sign out</a>
      </div>
    </div>

    <AppFooter />
  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scrollbar-gutter: stable; }
:root {
  --bg: #0b0c0e; --bg2: #111214; --border: #1e2025; --dim2: #2a2d35;
  --text: #e4e6ea; --muted: #8892a4; --accent: #4d9fff;
  --warn: #ffb800; --fail: #ff4455; --pass: #34d399;
}
body {
  background: var(--bg); color: var(--text);
  font-family: 'Inter', sans-serif; font-size: 14px;
  line-height: 1.5; min-height: 100vh;
}
</style>

<style scoped>
.nav-link { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); text-decoration: none; letter-spacing: 0.05em; padding: 5px 10px; border-radius: 4px; transition: background 0.15s, color 0.15s; }
.nav-link:hover { background: rgba(228,230,234,0.06); color: var(--text); }
.nav-link-current { color: var(--accent); background: rgba(77,159,255,0.08); pointer-events: none; }

.page { max-width: 760px; margin: 0 auto; padding: 48px 32px 80px; }
.page-title { font-size: 22px; font-weight: 600; color: var(--text); margin-bottom: 32px; }

.card { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 24px; margin-bottom: 16px; }
.card-title { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-bottom: 16px; }

.profile-row { display: flex; align-items: center; gap: 16px; }
.profile-avatar { width: 48px; height: 48px; border-radius: 50%; border: none; box-shadow: 0 0 0 2px var(--bg2), 0 0 0 3px var(--border); transition: box-shadow 0.2s; }
.profile-avatar:hover { box-shadow: 0 0 0 2px var(--bg2), 0 0 0 3px var(--accent); }
.profile-name { font-size: 15px; font-weight: 600; color: var(--text); }
.profile-email { font-size: 12px; color: var(--muted); margin-top: 2px; }

.plan-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.plan-badge { font-family: 'Space Mono', monospace; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 16px; border-radius: 4px; }
.plan-limits { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 16px; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.plan-limit-item { padding: 12px 16px; border-right: 1px solid var(--border); }
.plan-limit-item:last-child { border-right: none; }
.plan-limit-item strong { display: block; font-family: 'Space Mono', monospace; font-size: 18px; font-weight: 700; color: var(--text); line-height: 1.2; }
.plan-limit-item span { display: block; font-size: 11px; color: var(--muted); margin-top: 3px; }

.upgrade-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.upgrade-copy { font-size: 13px; color: var(--muted); }
.btn-view-plans { font-family: 'Space Mono', monospace; font-size: 12px; color: var(--accent); background: none; border: 1px solid var(--accent); border-radius: 4px; padding: 9px 20px; text-decoration: none; white-space: nowrap; transition: background 0.15s, color 0.15s; }
.btn-view-plans:hover { background: var(--accent); color: #fff; }
.btn-manage { font-family: 'Space Mono', monospace; font-size: 12px; background: none; color: var(--accent); border: 1px solid var(--accent); border-radius: 4px; padding: 9px 20px; cursor: pointer; transition: background 0.15s, color 0.15s; }
.btn-manage:hover { background: var(--accent); color: #fff; }

.upgraded-notice { background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.3); border-radius: 6px; padding: 12px 16px; font-size: 13px; color: var(--pass); margin-bottom: 20px; }

.btn-signout { font-family: 'Space Mono', monospace; font-size: 12px; color: var(--muted); background: none; border: 1px solid var(--border); border-radius: 4px; padding: 8px 16px; cursor: pointer; text-decoration: none; display: inline-block; transition: color 0.15s, border-color 0.15s; }
.btn-signout:hover { color: var(--fail); border-color: var(--fail); }
</style>
