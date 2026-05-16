<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useHead({ title: 'Account — SearchGrade' })

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
const isPro      = computed(() => plan.value === 'pro' || plan.value === 'agency')

const hasBilling     = ref(false)
const totalReports   = ref(0)
const monthlyReports = ref(0)
const pdfLogoUrl     = ref('')
const pdfLogoSaving  = ref(false)
const pdfLogoSaved   = ref(false)
const pdfLogoError   = ref('')

const gscConnected     = ref(false)
const notifySlackUrl    = ref('')
const notifyTeamsUrl    = ref('')
const digestFrequency   = ref<string|null>(null)
const notifySaving      = ref(false)
const notifySaved       = ref(false)
const notifyError       = ref('')

const brandColor       = ref('#4d9fff')
const whiteLabel       = ref(false)
const brandingSaving   = ref(false)
const brandingSaved    = ref(false)
const brandingError    = ref('')

const widgetLeadCapture     = ref(false)
const widgetLeadSaving      = ref(false)
const widgetLeadSaved       = ref(false)
const widgetLeads           = ref<any[]>([])
const widgetLeadsLoading    = ref(false)

const showDeleteConfirm = ref(false)
const deleteConfirmText = ref('')
const deleteError       = ref('')
const deleteInProgress  = ref(false)

const isDev          = import.meta.dev
const devPlanBusy    = ref(false)
const devEmailBusy   = ref(false)
const devEmailResult = ref<any>(null)

async function devSendTestEmails() {
  devEmailBusy.value   = true
  devEmailResult.value = null
  try {
    devEmailResult.value = await $fetch('/api/dev/send-test-email')
  } catch (e: any) {
    devEmailResult.value = { error: e.data?.message || e.message }
  } finally {
    devEmailBusy.value = false
  }
}

async function devSetPlan(p: string) {
  devPlanBusy.value = true
  try {
    await $fetch('/api/dev/set-plan', { method: 'POST', body: { plan: p } })
    window.location.reload()
  } catch (e: any) {
    alert(e.data?.message || 'Failed to set plan')
    devPlanBusy.value = false
  }
}

// API keys state
const apiKeys            = ref([])
const newKeyLabel        = ref('')
const createdKey         = ref('')
const keyError           = ref('')
const confirmRevokeKeyId = ref<number | null>(null)

// Webhooks state
const webhooks             = ref([])
const newWebhookUrl        = ref('')
const webhookError         = ref('')
const createdWebhookSecret = ref('')

// Scheduled audits state
const schedules     = ref([])
const scheduleUrl   = ref('')
const scheduleFreq  = ref('weekly')
const scheduleAdding = ref(false)
const scheduleError = ref('')

async function loadApiKeys() {
  try { apiKeys.value = await $fetch('/api/keys') } catch {}
}

async function loadWebhooks() {
  try { webhooks.value = await $fetch('/api/webhooks') } catch {}
}

async function loadSchedules() {
  try { schedules.value = await $fetch('/api/scheduled') } catch {}
}

async function addSchedule() {
  if (!scheduleUrl.value.trim()) return
  scheduleAdding.value = true
  scheduleError.value = ''
  try {
    const s: any = await $fetch('/api/scheduled', {
      method: 'POST',
      body: { url: scheduleUrl.value.trim(), frequency: scheduleFreq.value },
    })
    schedules.value = [s, ...(schedules.value as any[])]
    scheduleUrl.value = ''
  } catch (e: any) {
    scheduleError.value = e.data?.message || 'Failed to add schedule.'
  }
  scheduleAdding.value = false
}

async function deleteSchedule(id: number) {
  try {
    await $fetch(`/api/scheduled/${id}`, { method: 'DELETE' })
    schedules.value = (schedules.value as any[]).filter((s: any) => s.id !== id)
  } catch {}
}

async function toggleSchedule(s: any) {
  try {
    const updated: any = await $fetch(`/api/scheduled/${s.id}`, { method: 'PATCH', body: { enabled: !s.enabled } })
    const idx = (schedules.value as any[]).findIndex((x: any) => x.id === s.id)
    if (idx !== -1) (schedules.value as any[])[idx] = updated
  } catch {}
}

function formatNextRun(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function createWebhook() {
  webhookError.value = ''
  createdWebhookSecret.value = ''
  try {
    const res = await $fetch('/api/webhooks', { method: 'POST', body: { url: newWebhookUrl.value } })
    createdWebhookSecret.value = (res as any).secret
    newWebhookUrl.value = ''
    await loadWebhooks()
  } catch (e: any) { webhookError.value = e.data?.message || 'Failed to create webhook.' }
}

async function deleteWebhook(id: number) {
  await $fetch(`/api/webhooks/${id}`, { method: 'DELETE' })
  await loadWebhooks()
}

async function createApiKey() {
  keyError.value  = ''
  createdKey.value = ''
  try {
    const res = await $fetch('/api/keys', { method: 'POST', body: { label: newKeyLabel.value } })
    createdKey.value = res.key
    newKeyLabel.value = ''
    await loadApiKeys()
  } catch (e: any) { keyError.value = e.data?.message || 'Failed to create key.' }
}

async function deleteApiKey(id: number) {
  await $fetch(`/api/keys/${id}`, { method: 'DELETE' })
  confirmRevokeKeyId.value = null
  createdKey.value = ''
  await loadApiKeys()
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

async function savePdfLogo() {
  pdfLogoSaving.value = true; pdfLogoError.value = ''; pdfLogoSaved.value = false
  try {
    await $fetch('/api/account/pdf-logo', { method: 'PATCH', body: { logoUrl: pdfLogoUrl.value } })
    pdfLogoSaved.value = true
    setTimeout(() => { pdfLogoSaved.value = false }, 2500)
  } catch (e: any) { pdfLogoError.value = e.data?.message || 'Failed to save.' }
  finally { pdfLogoSaving.value = false }
}

async function saveWidgetLeadCapture() {
  widgetLeadSaving.value = true
  try {
    await $fetch('/api/account/notify', { method: 'POST', body: { widgetLeadCapture: widgetLeadCapture.value } })
    widgetLeadSaved.value = true
    setTimeout(() => { widgetLeadSaved.value = false }, 2500)
  } catch {}
  finally { widgetLeadSaving.value = false }
}

async function loadWidgetLeads() {
  widgetLeadsLoading.value = true
  try { widgetLeads.value = await $fetch('/api/widget-leads') } catch {}
  finally { widgetLeadsLoading.value = false }
}

function exportLeadsCSV() {
  const rows = [['Email', 'URL', 'Score', 'Grade', 'Date', 'API Key']];
  for (const l of widgetLeads.value) {
    rows.push([l.email, l.url, l.score ?? '', l.grade ?? '', new Date(l.created_at).toLocaleDateString('en-US'), l.key_label || ''])
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
  a.download = 'widget-leads.csv'
  a.click()
}

async function saveBranding() {
  brandingSaving.value = true; brandingError.value = ''; brandingSaved.value = false
  try {
    await $fetch('/api/account/branding', { method: 'POST', body: { brandColor: brandColor.value, whiteLabel: whiteLabel.value } })
    brandingSaved.value = true
    setTimeout(() => { brandingSaved.value = false }, 2500)
  } catch (e: any) { brandingError.value = e.data?.message || 'Failed to save.' }
  finally { brandingSaving.value = false }
}

async function saveNotifySettings() {
  notifySaving.value = true; notifyError.value = ''; notifySaved.value = false
  try {
    await $fetch('/api/account/notify', { method: 'POST', body: { slackUrl: notifySlackUrl.value, teamsUrl: notifyTeamsUrl.value, digestFrequency: digestFrequency.value } })
    notifySaved.value = true
    setTimeout(() => { notifySaved.value = false }, 2500)
  } catch (e: any) { notifyError.value = e.data?.message || 'Failed to save.' }
  finally { notifySaving.value = false }
}

async function deleteAccount() {
  if (deleteConfirmText.value !== 'DELETE') return
  deleteInProgress.value = true; deleteError.value = ''
  try {
    await $fetch('/api/account', { method: 'DELETE' })
    window.location.href = '/'
  } catch (e: any) {
    deleteError.value = e.data?.message || 'Failed to delete account.'
    deleteInProgress.value = false
  }
}

const embedOrigin = ref('')
const widgetEmbedCode = computed(() => `<script src="${embedOrigin.value}/widget.js" data-key="YOUR_KEY"></` + `script>`)

onMounted(async () => {
  embedOrigin.value = window.location.origin
  try {
    const d: any = await $fetch('/api/account-data')
    hasBilling.value     = d.hasBilling     ?? false
    totalReports.value   = d.totalReports   ?? 0
    monthlyReports.value = d.monthlyReports ?? 0
    pdfLogoUrl.value     = d.pdfLogoUrl     ?? ''
    notifySlackUrl.value  = d.notifySlackUrl   ?? ''
    notifyTeamsUrl.value  = d.notifyTeamsUrl   ?? ''
    digestFrequency.value = d.digestFrequency  ?? null
    if (d.brandColor) brandColor.value = d.brandColor
    whiteLabel.value          = d.whiteLabel         ?? false
    widgetLeadCapture.value   = d.widgetLeadCapture  ?? false
    gscConnected.value        = d.gscConnected       ?? false
  } catch {}
  if (isPro.value) {
    loadApiKeys()
    loadWebhooks()
    loadSchedules()
    loadWidgetLeads()
  }
})
</script>

<template>
  <div>
    <AppNav>
      <AppNavAuth />
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
        <div v-if="isAgency" style="margin-top:20px">
          <div class="card-title" style="margin-bottom:10px">PDF Logo URL</div>
          <p class="acct-api-desc">Automatically applied to every PDF you generate. Replaces the SEARCHGRADE wordmark with your agency logo.</p>
          <div class="acct-key-form">
            <input v-model="pdfLogoUrl" class="acct-key-input" type="url" placeholder="https://youragency.com/logo.png" maxlength="500" />
            <button class="acct-key-create-btn" :disabled="pdfLogoSaving" @click="savePdfLogo">{{ pdfLogoSaving ? 'Saving…' : 'Save' }}</button>
          </div>
          <div v-if="pdfLogoSaved" style="font-size:12px;color:var(--pass);margin-top:8px">Saved.</div>
          <div v-if="pdfLogoError" class="acct-key-error">{{ pdfLogoError }}</div>
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
        <p class="plan-retention">Reports are kept indefinitely, subject to change with 30 days' notice.</p>
      </div>

      <!-- Usage -->
      <div class="card">
        <div class="card-title">Usage</div>
        <div class="plan-limits">
          <div class="plan-limit-item">
            <strong>{{ monthlyReports }}</strong>
            <span>audits this month</span>
          </div>
          <div class="plan-limit-item">
            <strong>{{ totalReports }}</strong>
            <span>reports saved</span>
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

      <!-- Google Integrations (pro/agency) -->
      <div v-if="isPro" class="card">
        <div class="card-title">Google Integrations</div>
        <p class="acct-api-desc" style="margin-bottom:16px">Connect your Google account to surface Search Console and Analytics 4 data directly on your audit reports.</p>
        <div class="gint-row">
          <div class="gint-status">
            <span class="gint-dot" :class="gscConnected ? 'gint-dot-on' : 'gint-dot-off'"></span>
            <span class="gint-label">{{ gscConnected ? 'Connected' : 'Not connected' }}</span>
          </div>
          <div class="gint-services">
            <span class="gint-chip">Search Console</span>
            <span class="gint-chip">Analytics 4</span>
          </div>
          <a href="/auth/google" class="acct-key-create-btn" style="text-decoration:none;display:inline-block">
            {{ gscConnected ? 'Reconnect →' : 'Connect Google →' }}
          </a>
        </div>
        <p class="acct-api-desc" style="margin-top:12px;font-size:11px">When connected, top queries and session data appear automatically on page audit results and saved report views.</p>
      </div>

      <!-- API Access (pro/agency) -->
      <div v-if="isPro" class="card">
        <div class="card-title">API Access</div>
        <p class="acct-api-desc">Use API keys to run audits programmatically. <a href="/docs" target="_blank" class="acct-docs-link">View API docs →</a></p>

        <!-- One-time key reveal -->
        <div v-if="createdKey" class="acct-key-reveal">
          <div class="acct-key-reveal-label">Copy this key now — it won't be shown again.</div>
          <div class="acct-key-reveal-row">
            <code class="acct-key-code">{{ createdKey }}</code>
            <button class="acct-copy-btn" @click="copyText(createdKey)">Copy</button>
          </div>
        </div>

        <!-- Existing keys -->
        <table v-if="apiKeys.length" class="acct-key-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Key prefix</th>
              <th>Created</th>
              <th>Last used</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="k in apiKeys" :key="k.id">
              <tr>
                <td>{{ k.label || '—' }}</td>
                <td><code class="acct-key-prefix">{{ k.prefix }}</code></td>
                <td>{{ new Date(k.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</td>
                <td>{{ k.last_used_at ? new Date(k.last_used_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never' }}</td>
                <td><button class="acct-key-del" @click="confirmRevokeKeyId = k.id">Revoke</button></td>
              </tr>
              <tr v-if="confirmRevokeKeyId === k.id" class="key-confirm-row">
                <td colspan="5">
                  <div class="key-confirm-inner">
                    <span class="key-confirm-text">This will break any integration using this key.</span>
                    <div class="key-confirm-actions">
                      <button class="acct-key-del key-confirm-danger" @click="deleteApiKey(k.id)">Yes, revoke permanently</button>
                      <button class="acct-key-del" @click="confirmRevokeKeyId = null">Cancel</button>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>

        <!-- Create form -->
        <div class="acct-key-form">
          <input v-model="newKeyLabel" class="acct-key-input" type="text" placeholder="Label (optional)" maxlength="100" />
          <button class="acct-key-create-btn" @click="createApiKey">Create API Key</button>
        </div>
        <div v-if="keyError" class="acct-key-error">{{ keyError }}</div>
      </div>

      <!-- Webhooks (pro/agency) -->
      <div v-if="isPro" class="card">
        <div class="card-title">Webhooks</div>
        <p class="acct-api-desc">
          Receive a signed POST after each audit. Verify with the <code style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted)">X-SearchGrade-Signature</code> header (HMAC-SHA256).
        </p>

        <!-- One-time secret reveal -->
        <div v-if="createdWebhookSecret" class="acct-key-reveal">
          <div class="acct-key-reveal-label">Copy this secret now — it won't be shown again.</div>
          <div class="acct-key-reveal-row">
            <code class="acct-key-code">{{ createdWebhookSecret }}</code>
            <button class="acct-copy-btn" @click="copyText(createdWebhookSecret)">Copy</button>
          </div>
        </div>

        <!-- Existing webhooks -->
        <table v-if="webhooks.length" class="acct-key-table">
          <thead>
            <tr>
              <th>URL</th>
              <th>Events</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="wh in webhooks" :key="wh.id">
              <td><div class="wh-url" :title="wh.url">{{ wh.url }}</div></td>
              <td><code class="acct-key-prefix">{{ wh.events }}</code></td>
              <td>{{ new Date(wh.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</td>
              <td><button class="acct-key-del" @click="deleteWebhook(wh.id)">Remove</button></td>
            </tr>
          </tbody>
        </table>

        <!-- Create form -->
        <div class="acct-key-form">
          <input v-model="newWebhookUrl" class="acct-key-input" type="url" placeholder="https://hooks.zapier.com/..." maxlength="500" />
          <button class="acct-key-create-btn" @click="createWebhook">Add Webhook</button>
        </div>
        <div v-if="webhookError" class="acct-key-error">{{ webhookError }}</div>
      </div>

      <!-- Scheduled Audits (pro/agency) -->
      <div id="scheduled" class="card">
        <div class="card-title">Scheduled Audits</div>
        <template v-if="isPro">
          <p class="acct-api-desc" style="margin-bottom:16px">Automatically re-audit a URL on a weekly or monthly basis. Results are emailed and saved to your report history.</p>
          <div v-if="(schedules as any[]).length > 0" class="sched-list">
            <div v-for="s in (schedules as any[])" :key="s.id" class="sched-row">
              <div class="sched-url">{{ s.url }}</div>
              <span class="sched-freq">{{ s.frequency }}</span>
              <span class="sched-next">Next: {{ formatNextRun(s.next_run_at) }}</span>
              <button class="sched-toggle" :class="s.enabled ? 'sched-on' : 'sched-off'" @click="toggleSchedule(s)">
                {{ s.enabled ? 'On' : 'Off' }}
              </button>
              <button class="sched-del" @click="deleteSchedule(s.id)">Remove</button>
            </div>
          </div>
          <div v-else class="sched-empty">No scheduled audits yet.</div>
          <div class="sched-add">
            <input v-model="scheduleUrl" class="sched-input" type="text" placeholder="https://example.com" />
            <select v-model="scheduleFreq" class="sched-select">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <button class="sched-btn" :disabled="scheduleAdding" @click="addSchedule">
              {{ scheduleAdding ? 'Adding…' : '+ Add' }}
            </button>
          </div>
          <div v-if="scheduleError" class="sched-err">{{ scheduleError }}</div>
        </template>
        <div v-else class="sched-locked">
          Scheduled audits require Pro.
          <a href="/pricing" class="sched-upgrade">Upgrade →</a>
        </div>
      </div>

      <!-- Notifications (pro/agency) -->
      <div v-if="isPro" class="card">
        <div class="card-title">Notifications</div>
        <p class="acct-api-desc" style="margin-bottom:16px">Receive scheduled audit results and score drop alerts in Slack or Microsoft Teams. Paste an incoming webhook URL below.</p>
        <div class="acct-notify-row">
          <label class="acct-notify-label">Slack Webhook URL</label>
          <div class="acct-key-form">
            <input v-model="notifySlackUrl" class="acct-key-input" type="url" placeholder="https://hooks.slack.com/services/..." maxlength="500" />
          </div>
        </div>
        <div class="acct-notify-row" style="margin-top:12px">
          <label class="acct-notify-label">Microsoft Teams Webhook URL</label>
          <div class="acct-key-form">
            <input v-model="notifyTeamsUrl" class="acct-key-input" type="url" placeholder="https://outlook.office.com/webhook/..." maxlength="500" />
          </div>
        </div>
        <div class="acct-notify-row" style="margin-top:12px">
          <label class="acct-notify-label">Email Digest</label>
          <select v-model="digestFrequency" class="acct-digest-select">
            <option :value="null">Off</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <span class="acct-digest-hint">Receive a summary of all monitored sites' scores in one email.</span>
        </div>
        <div style="margin-top:14px">
          <button class="acct-key-create-btn" :disabled="notifySaving" @click="saveNotifySettings">{{ notifySaving ? 'Saving…' : 'Save' }}</button>
          <span v-if="notifySaved" style="font-size:12px;color:var(--pass);margin-left:10px">Saved.</span>
        </div>
        <div v-if="notifyError" class="acct-key-error">{{ notifyError }}</div>
      </div>

      <!-- White-Label Branding (agency only) -->
      <div v-if="isAgency" class="card">
        <div class="card-title">White-Label Branding</div>
        <p class="acct-api-desc" style="margin-bottom:16px">Apply your brand color to shared reports and hide the SearchGrade footer. Color applies to links and accents on the public share page.</p>
        <div class="acct-notify-row">
          <label class="acct-notify-label">Brand Color</label>
          <div class="acct-key-form" style="gap:10px;align-items:center">
            <input v-model="brandColor" type="color" class="brand-color-input" />
            <input v-model="brandColor" class="acct-key-input" type="text" placeholder="#4d9fff" maxlength="7" style="width:120px;flex:none" />
          </div>
        </div>
        <div class="acct-notify-row" style="margin-top:14px">
          <label class="acct-notify-label" style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input v-model="whiteLabel" type="checkbox" class="brand-wl-checkbox" />
            Hide "Powered by SearchGrade" on shared reports
          </label>
        </div>
        <div style="margin-top:14px">
          <button class="acct-key-create-btn" :disabled="brandingSaving" @click="saveBranding">{{ brandingSaving ? 'Saving…' : 'Save' }}</button>
          <span v-if="brandingSaved" style="font-size:12px;color:var(--pass);margin-left:10px">Saved.</span>
        </div>
        <div v-if="brandingError" class="acct-key-error">{{ brandingError }}</div>
      </div>

      <!-- Widget embed code (agency only) -->
      <div v-if="isAgency" class="card">
        <div class="card-title">Embeddable Widget</div>
        <p class="acct-api-desc">Add a live audit widget to any page. Generate an API key above, then paste this snippet where you want the widget to appear.</p>
        <div class="acct-embed-wrap">
          <code class="acct-embed-code">{{ widgetEmbedCode }}</code>
          <button class="acct-copy-btn" @click="copyText(widgetEmbedCode)">Copy</button>
        </div>
      </div>

      <!-- Widget Lead Capture (agency only) -->
      <div v-if="isAgency" class="card">
        <div class="card-title">Widget Lead Capture</div>
        <p class="acct-api-desc" style="margin-bottom:16px">When enabled, widget visitors must enter their email before seeing full audit results. Leads are saved below.</p>
        <div class="acct-notify-row">
          <label class="acct-notify-label" style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input v-model="widgetLeadCapture" type="checkbox" class="brand-wl-checkbox" @change="saveWidgetLeadCapture" />
            Enable email gate on widget
          </label>
          <span v-if="widgetLeadSaved" style="font-size:12px;color:var(--pass);margin-left:10px">Saved.</span>
        </div>

        <template v-if="widgetLeads.length">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:20px;margin-bottom:10px">
            <div class="card-title" style="margin:0">Leads ({{ widgetLeads.length }})</div>
            <button class="acct-key-create-btn" style="font-size:11px;padding:5px 12px" @click="exportLeadsCSV">Export CSV</button>
          </div>
          <table class="acct-key-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>URL</th>
                <th>Score</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="lead in widgetLeads.slice(0, 50)" :key="lead.id">
                <td>{{ lead.email }}</td>
                <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="lead.url">{{ lead.url }}</td>
                <td>{{ lead.score != null ? `${lead.score} (${lead.grade})` : '—' }}</td>
                <td>{{ new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="widgetLeads.length > 50" style="font-size:11px;color:var(--muted);margin-top:8px">Showing 50 of {{ widgetLeads.length }}. Export CSV to see all.</div>
        </template>
        <div v-else-if="!widgetLeadsLoading" style="font-size:13px;color:var(--muted);margin-top:16px">No leads yet. Enable the email gate and embed your widget to start collecting leads.</div>
      </div>

      <!-- Dev Tools (development only) -->
      <div v-if="isDev" class="card dev-card">
        <div class="card-title">Dev Tools</div>
        <p class="acct-api-desc" style="margin-bottom:12px">Switch plan for testing gated features. Remove before production.</p>
        <div class="dev-plan-row">
          <button
            v-for="p in ['free', 'pro', 'agency']"
            :key="p"
            class="dev-plan-btn"
            :class="{ active: plan === p }"
            :disabled="devPlanBusy || plan === p"
            @click="devSetPlan(p)"
          >{{ p }}</button>
        </div>
        <p class="acct-api-desc" style="margin-top:20px;margin-bottom:8px">Send all three email types to your account address.</p>
        <button class="dev-plan-btn" :disabled="devEmailBusy" @click="devSendTestEmails">
          {{ devEmailBusy ? 'Sending…' : 'Send Test Emails' }}
        </button>
        <div v-if="devEmailResult" style="margin-top:10px;font-family:'Space Mono',monospace;font-size:11px;line-height:1.8">
          <div v-if="devEmailResult.error" style="color:var(--fail)">{{ devEmailResult.error }}</div>
          <template v-else>
            <div>Sent to: {{ devEmailResult.to }}</div>
            <div v-for="e in devEmailResult.emails" :key="e.type">
              <span :style="{ color: e.status === 'fulfilled' ? 'var(--pass)' : 'var(--fail)' }">
                {{ e.status === 'fulfilled' ? '✓' : '✕' }}
              </span>
              {{ e.type }}{{ e.error ? ` — ${e.error}` : '' }}
            </div>
          </template>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="card danger-card">
        <div class="card-title">Danger Zone</div>
        <p class="acct-api-desc">Permanently delete your account and all associated data. This cannot be undone.</p>
        <div v-if="!showDeleteConfirm">
          <button class="btn-danger" @click="showDeleteConfirm = true">Delete my account</button>
        </div>
        <div v-else class="delete-confirm-wrap">
          <p class="delete-confirm-label">Type <strong>DELETE</strong> to confirm:</p>
          <div class="acct-key-form">
            <input v-model="deleteConfirmText" class="acct-key-input" type="text" placeholder="DELETE" maxlength="10" />
            <button class="btn-danger" :disabled="deleteConfirmText !== 'DELETE' || deleteInProgress" @click="deleteAccount">
              {{ deleteInProgress ? 'Deleting…' : 'Yes, delete my account' }}
            </button>
          </div>
          <div v-if="deleteError" class="acct-key-error">{{ deleteError }}</div>
          <button class="btn-cancel-delete" @click="showDeleteConfirm = false; deleteConfirmText = ''">Cancel</button>
        </div>
      </div>

      <!-- Sign out -->
      <div class="card">
        <div class="card-title">Session</div>
        <a href="/auth/logout" class="btn-signout">Sign out</a>
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
body {
  background: var(--bg); color: var(--text);
  font-family: 'Inter', sans-serif; font-size: 14px;
  line-height: 1.5; min-height: 100vh;
}
</style>

<style scoped>

.page { max-width: 960px; margin: 0 auto; padding: 48px 32px 80px; }
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

/* API Access */
.acct-api-desc { font-size: 13px; color: var(--muted); margin-bottom: 16px; }
.acct-docs-link { color: var(--accent); text-decoration: none; }
.acct-docs-link:hover { text-decoration: underline; }
.acct-key-reveal { background: rgba(52,211,153,0.06); border: 1px solid rgba(52,211,153,0.25); border-radius: 6px; padding: 14px 16px; margin-bottom: 16px; }
.acct-key-reveal-label { font-size: 12px; color: var(--pass); margin-bottom: 10px; }
.acct-key-reveal-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.acct-key-code { font-family: 'Space Mono', monospace; font-size: 12px; color: var(--text); background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 4px; padding: 8px 12px; word-break: break-all; flex: 1; }
.acct-key-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
.acct-key-table th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; color: var(--muted); padding: 0 12px 8px 0; border-bottom: 1px solid var(--border); }
.acct-key-table td { padding: 10px 12px 10px 0; border-bottom: 1px solid var(--border); color: var(--text); }
.acct-key-table tr:last-child td { border-bottom: none; }
.acct-key-prefix { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--muted); }
.acct-key-del { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.05em; color: var(--muted); background: none; border: 1px solid var(--border); border-radius: 3px; padding: 4px 10px; cursor: pointer; transition: color 0.15s, border-color 0.15s; }
.acct-key-del:hover { color: var(--fail); border-color: var(--fail); }
.key-confirm-row td { background: rgba(255,68,85,0.04); border-top: none; padding: 10px 16px 14px; }
.key-confirm-inner { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.key-confirm-text { font-size: 12px; color: var(--muted); flex: 1; min-width: 180px; }
.key-confirm-actions { display: flex; gap: 8px; flex-shrink: 0; }
.key-confirm-danger { color: var(--fail); border-color: rgba(255,68,85,0.4); }
.acct-key-form { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
.acct-key-input { flex: 1; min-width: 180px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--text); font-size: 13px; padding: 9px 12px; outline: none; transition: border-color 0.15s; }
.acct-key-input:focus { border-color: var(--accent); }
.acct-key-create-btn { font-family: 'Space Mono', monospace; font-size: 12px; color: var(--accent); background: none; border: 1px solid var(--accent); border-radius: 4px; padding: 9px 18px; cursor: pointer; white-space: nowrap; transition: background 0.15s, color 0.15s; }
.acct-key-create-btn:hover { background: var(--accent); color: #fff; }
.acct-key-error { font-size: 12px; color: var(--fail); margin-top: 10px; }
.acct-notify-row { display: flex; flex-direction: column; gap: 6px; }
.acct-notify-label { font-size: 12px; color: var(--muted); font-family: 'Space Mono', monospace; letter-spacing: 0.04em; }
.acct-digest-select { background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-family: 'Space Mono', monospace; font-size: 12px; padding: 7px 10px; width: 160px; cursor: pointer; }
.acct-digest-select:focus { outline: none; border-color: var(--accent); }
.acct-digest-hint { font-size: 11px; color: var(--muted); opacity: 0.7; }
.wh-url { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--text); }
.acct-copy-btn { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.05em; color: var(--accent); background: none; border: 1px solid var(--accent); border-radius: 3px; padding: 6px 14px; cursor: pointer; white-space: nowrap; transition: background 0.15s, color 0.15s; }
.acct-copy-btn:hover { background: var(--accent); color: #fff; }
.acct-embed-wrap { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
.acct-embed-code { display: block; flex: 1; font-family: 'Space Mono', monospace; font-size: 11px; color: var(--muted); background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 4px; padding: 10px 12px; word-break: break-all; line-height: 1.6; }

.sched-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.sched-row { display: flex; align-items: center; gap: 12px; font-size: 13px; flex-wrap: wrap; }
.sched-url { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
.sched-freq { font-family: 'Space Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); border: 1px solid var(--border); padding: 2px 8px; border-radius: 3px; }
.sched-next { font-size: 11px; color: var(--muted); white-space: nowrap; }
.sched-toggle { font-family: 'Space Mono', monospace; font-size: 10px; border: 1px solid var(--border); border-radius: 3px; padding: 3px 10px; cursor: pointer; }
.sched-on { color: var(--pass); border-color: var(--pass); background: none; }
.sched-off { color: var(--muted); background: none; }
.sched-del { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); background: none; border: 1px solid var(--border); border-radius: 3px; padding: 3px 10px; cursor: pointer; }
.sched-del:hover { color: var(--fail); border-color: var(--fail); }
.sched-empty { font-size: 13px; color: var(--muted); margin-bottom: 16px; }
.sched-add { display: flex; gap: 8px; flex-wrap: wrap; }
.sched-input { flex: 1; min-width: 200px; background: var(--bg); border: 1px solid var(--border); color: var(--text); font-family: 'Inter', sans-serif; font-size: 13px; padding: 7px 12px; outline: none; }
.sched-input:focus { border-color: var(--accent); }
.sched-select { background: var(--bg); border: 1px solid var(--border); color: var(--muted); font-family: 'Space Mono', monospace; font-size: 11px; padding: 7px 10px; cursor: pointer; outline: none; }
.sched-btn { font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 0.06em; color: var(--accent); background: none; border: 1px solid var(--accent); padding: 7px 16px; cursor: pointer; }
.sched-btn:hover { background: var(--accent); color: #fff; }
.sched-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sched-err { font-size: 12px; color: var(--fail); margin-top: 8px; }
.sched-locked { font-size: 13px; color: var(--muted); }
.sched-upgrade { color: var(--accent); text-decoration: none; margin-left: 8px; }
.sched-upgrade:hover { text-decoration: underline; }

.plan-retention { font-size: 11px; color: var(--muted); margin-top: 14px; }

.danger-card { border-color: rgba(255,68,85,0.25); }
.danger-card .card-title { color: var(--fail); opacity: 0.7; }
.btn-danger { font-family: 'Space Mono', monospace; font-size: 12px; color: var(--fail); background: none; border: 1px solid rgba(255,68,85,0.4); border-radius: 4px; padding: 8px 18px; cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s; }
.btn-danger:hover:not(:disabled) { background: rgba(255,68,85,0.1); border-color: var(--fail); }
.btn-danger:disabled { opacity: 0.35; cursor: not-allowed; }
.delete-confirm-wrap { display: flex; flex-direction: column; gap: 10px; }
.delete-confirm-label { font-size: 13px; color: var(--muted); }
.btn-cancel-delete { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); background: none; border: none; cursor: pointer; padding: 0; text-decoration: underline; align-self: flex-start; }

.dev-card { border-color: #3a2d1a; background: #110e08; }
.dev-card .card-title { color: #ffb800aa; }
.dev-plan-row { display: flex; gap: 8px; }
.dev-plan-btn { font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; padding: 7px 20px; border-radius: 4px; border: 1px solid var(--border); background: none; color: var(--muted); cursor: pointer; transition: border-color 0.15s, color 0.15s, background 0.15s; }
.dev-plan-btn:hover:not(:disabled) { border-color: var(--warn); color: var(--warn); }
.dev-plan-btn.active { border-color: var(--warn); color: var(--warn); background: rgba(255,184,0,0.08); cursor: default; }
.dev-plan-btn:disabled:not(.active) { opacity: 0.4; cursor: not-allowed; }

.brand-color-input { width: 38px; height: 32px; padding: 2px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg2); cursor: pointer; }
.brand-wl-checkbox { accent-color: var(--accent); width: 14px; height: 14px; cursor: pointer; }

.gint-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.gint-status { display: flex; align-items: center; gap: 8px; }
.gint-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.gint-dot-on { background: var(--pass); box-shadow: 0 0 6px var(--pass); }
.gint-dot-off { background: var(--border); }
.gint-label { font-size: 13px; color: var(--text); }
.gint-services { display: flex; gap: 6px; flex: 1; }
.gint-chip { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.05em; color: var(--muted); border: 1px solid var(--border); border-radius: 3px; padding: 3px 8px; }

</style>
