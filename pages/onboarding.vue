<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useHead({ title: 'Get Started — SearchGrade' })

const step      = ref(1)
const urlInput  = ref('')
const running   = ref(false)
const auditDone = ref(false)
const score     = ref<number | null>(null)
const grade     = ref<string | null>(null)
const topFails  = ref<any[]>([])
const errorMsg  = ref('')

async function markOnboarded() {
  try { await $fetch('/api/account/onboarded', { method: 'PATCH' }) } catch {}
}

async function runAudit() {
  if (!urlInput.value.trim()) return
  running.value = true
  errorMsg.value = ''
  let url = urlInput.value.trim()
  if (!/^https?:\/\//.test(url)) url = 'https://' + url
  try {
    const res = await fetch('/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        try {
          const msg = JSON.parse(line.slice(5).trim())
          if (msg.type === 'done') {
            score.value  = msg.totalScore
            grade.value  = msg.grade
            topFails.value = (msg.results || [])
              .filter((r: any) => r.status === 'fail')
              .slice(0, 3)
              .map((r: any) => ({ name: r.name.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, ''), message: r.message }))
            auditDone.value = true
            step.value = 2
          } else if (msg.type === 'error') {
            errorMsg.value = msg.message || 'Audit failed'
          }
        } catch {}
      }
    }
  } catch (e: any) {
    errorMsg.value = e?.message || 'Something went wrong. Please try again.'
  } finally {
    running.value = false
  }
}

async function skip() {
  await markOnboarded()
  navigateTo('/dashboard')
}

async function finish() {
  await markOnboarded()
  navigateTo('/dashboard')
}
</script>

<template>
  <div>
    <AppNav>
      <AppNavAuth />
    </AppNav>
    <div class="onboard-wrap">

      <!-- Step indicators -->
      <div class="step-track">
        <div v-for="n in 3" :key="n" :class="['step-dot', { active: step === n, done: step > n }]">
          <span v-if="step > n">✓</span>
          <span v-else>{{ n }}</span>
        </div>
        <div class="step-line" />
      </div>

      <!-- Step 1: Run first audit -->
      <div v-if="step === 1" class="onboard-card">
        <div class="onboard-eyebrow">Step 1 of 3</div>
        <h1 class="onboard-title">Run your first audit</h1>
        <p class="onboard-sub">Enter any public URL to see your search visibility score instantly.</p>
        <div class="url-row">
          <input
            v-model="urlInput"
            class="url-input"
            type="text"
            placeholder="https://yoursite.com"
            @keydown.enter="runAudit"
          />
          <button class="btn-primary" :disabled="running" @click="runAudit">
            {{ running ? 'Auditing…' : 'Audit →' }}
          </button>
        </div>
        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        <button class="skip-link" @click="skip">Skip setup →</button>
      </div>

      <!-- Step 2: Results + explanation -->
      <div v-if="step === 2" class="onboard-card">
        <div class="onboard-eyebrow">Step 2 of 3</div>
        <h1 class="onboard-title">Your score: <span :class="'grade-' + grade">{{ grade }}</span> — {{ score }}/100</h1>
        <p class="onboard-sub">Each check is scored 0–100. Your overall grade is the average across all {{ score !== null ? 'checks' : '100+' }} checks.</p>
        <div v-if="topFails.length" class="top-fails">
          <div class="top-fails-label">Top 3 items to fix first:</div>
          <ol class="top-fails-list">
            <li v-for="(f, i) in topFails" :key="i">
              <strong>{{ f.name }}</strong>
              <span v-if="f.message"> — {{ f.message }}</span>
            </li>
          </ol>
        </div>
        <button class="btn-primary" @click="step = 3">Set up monitoring →</button>
        <button class="skip-link" @click="skip">Skip →</button>
      </div>

      <!-- Step 3: Set up monitoring -->
      <div v-if="step === 3" class="onboard-card">
        <div class="onboard-eyebrow">Step 3 of 3</div>
        <h1 class="onboard-title">Track changes over time</h1>
        <p class="onboard-sub">Scheduled audits alert you when your score drops — so you catch regressions before they hurt rankings.</p>
        <div class="setup-links">
          <a href="/account#scheduled" class="setup-card">
            <div class="setup-card-title">Scheduled Audits</div>
            <div class="setup-card-sub">Run audits daily or weekly and get email alerts on regressions</div>
          </a>
          <a href="/dashboard" class="setup-card">
            <div class="setup-card-title">Dashboard</div>
            <div class="setup-card-sub">View report history, score trends, and crawl diffs</div>
          </a>
        </div>
        <button class="btn-primary" @click="finish">Go to Dashboard →</button>
        <button class="skip-link" @click="skip">Skip →</button>
      </div>

    </div>
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
body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; font-size: 14px; line-height: 1.5; min-height: 100vh; }
</style>

<style scoped>
.onboard-wrap {
  max-width: 540px; margin: 0 auto; padding: 64px 24px 100px;
  display: flex; flex-direction: column; align-items: center; gap: 32px;
}

/* Step indicators */
.step-track {
  display: flex; gap: 12px; align-items: center; position: relative;
}
.step-dot {
  width: 32px; height: 32px; border-radius: 50%;
  border: 2px solid var(--border); background: var(--bg2);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Space Mono', monospace; font-size: 12px; font-weight: 700;
  color: var(--muted); transition: border-color 0.2s, color 0.2s, background 0.2s;
  position: relative; z-index: 1;
}
.step-dot.active { border-color: var(--accent); color: var(--accent); background: rgba(77,159,255,0.08); }
.step-dot.done { border-color: var(--pass); color: var(--pass); background: rgba(52,211,153,0.08); }
.step-line {
  position: absolute; top: 50%; left: 16px; right: 16px; height: 2px;
  background: var(--border); z-index: 0;
}

/* Card */
.onboard-card {
  width: 100%; background: var(--bg2); border: 1px solid var(--border); border-radius: 10px;
  padding: 36px 32px; display: flex; flex-direction: column; gap: 16px;
}
.onboard-eyebrow { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
.onboard-title { font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; line-height: 1.3; }
.onboard-sub { font-size: 14px; color: var(--muted); line-height: 1.6; }

.grade-A { color: var(--pass); }
.grade-B { color: var(--accent); }
.grade-C { color: var(--warn); }
.grade-D { color: #ff8800; }
.grade-F { color: var(--fail); }

/* URL input row */
.url-row { display: flex; gap: 8px; }
.url-input {
  flex: 1; background: var(--bg); border: 1px solid var(--border); border-radius: 4px;
  color: var(--text); font-family: 'Space Mono', monospace; font-size: 13px; padding: 10px 14px; outline: none;
  transition: border-color 0.15s;
}
.url-input:focus { border-color: var(--accent); }
.btn-primary {
  font-family: 'Space Mono', monospace; font-size: 12px; font-weight: 700;
  background: var(--accent); color: #000; border: none; border-radius: 4px;
  padding: 10px 20px; cursor: pointer; transition: background 0.15s;
  white-space: nowrap;
}
.btn-primary:hover:not(:disabled) { background: #76baff; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.error-msg { font-size: 13px; color: var(--fail); }

.skip-link {
  font-size: 12px; color: #7ec5ff; background: none; border: none;
  cursor: pointer; text-align: left; padding: 0; text-decoration: underline;
  text-underline-offset: 2px;
}
.skip-link:hover { color: #a8d9ff; }

/* Top fails */
.top-fails { background: rgba(255,68,85,0.06); border: 1px solid rgba(255,68,85,0.2); border-radius: 6px; padding: 14px 16px; }
.top-fails-label { font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fail); margin-bottom: 10px; }
.top-fails-list { padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.top-fails-list li { font-size: 13px; color: var(--text); }
.top-fails-list li span { color: var(--muted); }

/* Setup links */
.setup-links { display: flex; gap: 12px; }
.setup-card {
  flex: 1; background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  padding: 14px 16px; text-decoration: none; transition: border-color 0.15s;
}
.setup-card:hover { border-color: var(--accent); }
.setup-card-title { font-weight: 600; color: var(--text); margin-bottom: 4px; font-size: 13px; }
.setup-card-sub { font-size: 12px; color: var(--muted); line-height: 1.5; }
</style>
