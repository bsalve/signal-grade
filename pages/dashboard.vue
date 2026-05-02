<script setup>
definePageMeta({ middleware: 'auth' })
useHead({
  title: 'Dashboard — SignalGrade',
  script: [{ src: 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js' }],
})

const dashData = ref(null)

const user         = computed(() => dashData.value?.user ?? null)
const reports      = computed(() => dashData.value?.reports ?? [])
const reportCount  = computed(() => dashData.value?.reportCount ?? 0)
const hasReports   = computed(() => dashData.value?.hasReports ?? false)
const siteDiffGroups = computed(() => dashData.value?.siteDiffGroups ?? [])

const CAT_SPARK = [
  { key: 'technical', label: 'Tech',    color: '#8892a4' },
  { key: 'content',   label: 'Content', color: '#e8a87c' },
  { key: 'aeo',       label: 'AEO',     color: '#7baeff' },
  { key: 'geo',       label: 'GEO',     color: '#b07bff' },
]

function sparkPoints(vals, w, h) {
  if (vals.length < 2) return ''
  return vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w
    const y = h - (Math.min(Math.max(v, 0), 100) / 100) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

// Group page-audit reports by hostname for trend charts and compare links (≥2 reports per domain)
const trendGroups = computed(() => {
  const pageReports = reports.value.filter(r => r.audit_type === 'page' && r.score != null)
  const groups = {}
  for (const r of pageReports) {
    let host = r.url
    try { host = new URL(r.url).hostname } catch {}
    if (!groups[host]) groups[host] = []
    groups[host].push(r)
  }
  // Keep only domains with ≥2 reports; reverse to oldest→newest for chart; keep original order for compare
  return Object.entries(groups)
    .filter(([, items]) => items.length >= 2)
    .map(([host, items]) => {
      const chronological = [...items].reverse()
      const catSeries = CAT_SPARK.map(c => {
        const vals = chronological
          .map(r => r.catScores?.[c.key] ?? null)
          .filter(v => v !== null)
        return {
          key: c.key,
          label: c.label,
          color: c.color,
          points: sparkPoints(vals, 80, 24),
          latest: vals.length > 0 ? vals[vals.length - 1] : null,
          hasSeries: vals.length >= 2,
        }
      })
      return {
        host,
        items: chronological,
        compareUrl: `/compare?a=${items[1].id}&b=${items[0].id}`,
        catSeries,
      }
    })
})

function gradeColor(score) {
  if (score >= 90) return '#34d399'
  if (score >= 80) return '#4d9fff'
  if (score >= 70) return '#ffb800'
  if (score >= 60) return '#ff8800'
  return '#ff4455'
}

function buildCharts() {
  if (typeof window === 'undefined' || !window.Chart) return
  for (const group of trendGroups.value) {
    const canvasId = 'chart-' + group.host.replace(/\./g, '-')
    const canvas = document.getElementById(canvasId)
    if (!canvas) continue
    const labels = group.items.map(r => r.dateFormatted)
    const scores = group.items.map(r => r.score)
    const pointColors = scores.map(s => gradeColor(s))
    new window.Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: scores,
          borderColor: '#4d9fff',
          backgroundColor: 'rgba(77,159,255,0.08)',
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          pointRadius: 5,
          pointHoverRadius: 6,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          clip: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { left: 10, right: 10, top: 8, bottom: 4 } },
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => ` ${ctx.parsed.y}/100` },
          backgroundColor: '#111214',
          borderColor: '#1e2025',
          borderWidth: 1,
          titleColor: '#8892a4',
          bodyColor: '#e4e6ea',
        }},
        scales: {
          x: {
            grid: { color: '#1e2025' },
            offset: false,
            bounds: 'data',
            ticks: { display: false },
          },
          y: {
            min: 0, max: 100,
            grid: { color: '#1e2025' },
            ticks: { color: '#8892a4', font: { family: "'Space Mono', monospace", size: 10 }, stepSize: 25 },
          },
        },
      },
    })
  }
}

const expandedId = ref(null)

const deletingId = ref(null)
const deletingConfirmed = ref(null)

async function confirmDeleteReport(reportId) {
  deletingConfirmed.value = reportId
  deletingId.value = null
  try {
    const res = await $fetch(`/api/reports/${reportId}`, { method: 'DELETE' })
    if (res.ok) {
      dashData.value.reports = dashData.value.reports.filter(r => r.id !== reportId)
    }
  } catch {}
  deletingConfirmed.value = null
}

// Share state
const sharingId  = ref(null)
const copiedId   = ref(null)
const shareError = ref('')

async function shareReport(reportId) {
  sharingId.value = reportId
  shareError.value = ''
  try {
    const res = await $fetch(`/api/reports/${reportId}/share`, { method: 'POST' })
    const absoluteUrl = window.location.origin + res.shareUrl
    await navigator.clipboard.writeText(absoluteUrl)
    copiedId.value = reportId
    setTimeout(() => { if (copiedId.value === reportId) copiedId.value = null }, 2500)
  } catch (e) {
    shareError.value = e.data?.message || 'Failed to generate share link.'
  } finally {
    sharingId.value = null
  }
}

// Scheduled audits
const schedules = ref([])
const scheduleUrl = ref('')
const scheduleFreq = ref('weekly')
const scheduleAdding = ref(false)
const scheduleError = ref('')

const canSchedule = computed(() => {
  const p = user.value?.plan || 'free'
  return p === 'pro' || p === 'agency'
})

async function loadSchedules() {
  try { schedules.value = await $fetch('/api/scheduled') } catch {}
}

async function addSchedule() {
  if (!scheduleUrl.value.trim()) return
  scheduleAdding.value = true
  scheduleError.value = ''
  try {
    const s = await $fetch('/api/scheduled', {
      method: 'POST',
      body: { url: scheduleUrl.value.trim(), frequency: scheduleFreq.value },
    })
    schedules.value = [s, ...schedules.value]
    scheduleUrl.value = ''
  } catch (e) {
    scheduleError.value = e.data?.message || 'Failed to add schedule.'
  }
  scheduleAdding.value = false
}

async function deleteSchedule(id) {
  try {
    await $fetch(`/api/scheduled/${id}`, { method: 'DELETE' })
    schedules.value = schedules.value.filter(s => s.id !== id)
  } catch {}
}

async function toggleSchedule(s) {
  try {
    const updated = await $fetch(`/api/scheduled/${s.id}`, { method: 'PATCH', body: { enabled: !s.enabled } })
    const idx = schedules.value.findIndex(x => x.id === s.id)
    if (idx !== -1) schedules.value[idx] = updated
  } catch {}
}

function formatNextRun(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(async () => {
  try {
    dashData.value = await $fetch('/api/dashboard-data')
  } catch {
    // auth middleware will redirect if unauthenticated
  }
  await loadSchedules()
  await nextTick()
  // Wait for Chart.js CDN script to load then build charts
  if (trendGroups.value.length > 0) {
    const waitForChart = (attempts) => {
      if (window.Chart) { buildCharts(); return }
      if (attempts > 0) setTimeout(() => waitForChart(attempts - 1), 200)
    }
    waitForChart(20)
  }
})
</script>

<template>
  <div>
    <AppNav>
      <AppNavAuth />
    </AppNav>

    <div class="page">
      <div class="page-header">
        <div>
          <div class="page-title">Report History</div>
          <div class="page-subtitle">Your saved audits from SignalGrade</div>
        </div>
      </div>

      <template v-if="hasReports">
        <div class="dash-stats">
          <div class="stat-chip">
            <strong>{{ reportCount }}</strong> report{{ reportCount !== 1 ? 's' : '' }} saved
          </div>
          <a v-for="group in trendGroups" :key="group.host" :href="group.compareUrl" class="stat-chip stat-chip-link">
            Compare {{ group.host }} ↗
          </a>
          <a v-for="dg in siteDiffGroups" :key="'diff-'+dg.host" :href="`/report/crawl-diff?a=${dg.idA}&b=${dg.idB}`" class="stat-chip stat-chip-link stat-chip-diff">
            Crawl diff: {{ dg.host }} ↗
          </a>
        </div>

        <!-- Trend charts -->
        <div v-if="trendGroups.length > 0" class="trend-section">
          <div class="trend-title">Score Trends</div>
          <div class="trend-charts">
            <div v-for="group in trendGroups" :key="group.host" class="trend-card">
              <div class="trend-domain">{{ group.host }}</div>
              <div style="position:relative;height:140px;width:100%">
                <canvas :id="'chart-' + group.host.replace(/\./g, '-')"></canvas>
              </div>
              <!-- Category sparklines -->
              <div class="cat-sparks">
                <div v-for="cat in group.catSeries" :key="cat.key" class="cat-spark">
                  <div class="cat-spark-label" :style="`color:${cat.color}`">{{ cat.label }}</div>
                  <svg class="cat-spark-svg" viewBox="0 0 80 24" preserveAspectRatio="none">
                    <polyline v-if="cat.hasSeries" :points="cat.points" :stroke="cat.color" fill="none" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
                    <line v-else x1="0" y1="12" x2="80" y2="12" :stroke="cat.color" stroke-width="1" stroke-dasharray="3,3" opacity="0.35"/>
                  </svg>
                  <div class="cat-spark-score" :style="`color:${cat.color}`">{{ cat.latest ?? '—' }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Scheduled audits -->
        <div class="sched-section">
          <div class="sched-title">Scheduled Audits</div>
          <template v-if="canSchedule">
            <div v-if="schedules.length > 0" class="sched-list">
              <div v-for="s in schedules" :key="s.id" class="sched-row">
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

        <div class="table-label">All Reports</div>
        <table class="reports-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>URL</th>
              <th>Grade</th>
              <th>Score</th>
              <th>Date</th>
              <th>View</th>
              <th>PDF</th>
              <th>Share</th>
              <th class="del-col"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="report in reports" :key="report.id" :data-report-id="report.id">
              <td>
                <span
                  class="type-badge"
                  :style="`color:${report.typeColor};border:1px solid ${report.typeColor}22;background:${report.typeColor}11;`"
                >{{ report.typeLabel }}</span>
              </td>
              <td>
                <div class="report-url" :title="report.url">{{ report.url }}</div>
                <template v-if="report.parsedLocations && report.parsedLocations.length > 1">
                  <button class="url-expand-btn" @click="expandedId = expandedId === report.id ? null : report.id">
                    {{ expandedId === report.id ? '▾ collapse' : `▸ +${report.parsedLocations.length - 1} more` }}
                  </button>
                  <div v-if="expandedId === report.id" class="url-expand-list">
                    <div v-for="loc in report.parsedLocations" :key="loc.url" class="url-expand-row">
                      <span class="url-expand-url">{{ loc.url }}</span>
                      <span v-if="loc.grade && loc.score != null" class="url-expand-score" :style="`color:${gradeColor(loc.score)}`">{{ loc.grade }} {{ loc.score }}</span>
                    </div>
                  </div>
                </template>
              </td>
              <td>
                <span class="report-grade" :style="`color:${report.gradeColor};`">{{ report.grade }}</span>
              </td>
              <td>
                <span class="report-score">{{ report.score != null ? `${report.score}/100` : '—' }}</span>
                <span
                  v-if="report.scoreDelta !== null && report.scoreDelta !== 0"
                  class="score-delta"
                  :class="report.scoreDelta > 0 ? 'delta-up' : 'delta-down'"
                >{{ report.scoreDelta > 0 ? `↑${report.scoreDelta}` : `↓${Math.abs(report.scoreDelta)}` }}</span>
              </td>
              <td>
                <span class="report-date">{{ report.dateFormatted }}</span>
              </td>
              <td>
                <a
                  v-if="report.has_results"
                  :href="`/report/${report.id}`"
                  class="btn-view"
                >View</a>
                <span v-else class="btn-view btn-view-disabled">—</span>
              </td>
              <td>
                <a :href="`/api/reports/${report.id}/download`" class="pdf-link in">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                  Download PDF
                </a>
              </td>
              <td>
                <button
                  class="btn-share"
                  :disabled="sharingId === report.id"
                  @click="shareReport(report.id)"
                >{{ sharingId === report.id ? '…' : copiedId === report.id ? 'Copied!' : 'Share' }}</button>
              </td>
              <td class="del-cell">
                <span v-if="deletingConfirmed === report.id" class="del-status">Deleting…</span>
                <span v-else-if="deletingId === report.id" class="del-confirm">
                  <span>Sure?</span>
                  <span class="del-confirm-btns">
                    <button class="btn-del-yes" @click="confirmDeleteReport(report.id)">Yes</button>
                    <button class="btn-del-no" @click="deletingId = null">No</button>
                  </span>
                </span>
                <button v-else class="btn-delete" @click="deletingId = report.id">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-else>
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="9" y="2" width="6" height="4" rx="1"/>
              <path d="M16 4h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
              <line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
          </div>
          <div class="empty-title">No reports yet</div>
          <div class="empty-body">Run your first audit and it will be saved here automatically.</div>
          <a href="/" class="btn-new-audit">← Run new audit</a>
        </div>
      </template>
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
/* Override assets/main.css .pdf-link which has opacity:0, margin-bottom:48px */
.pdf-link { margin-bottom: 0 !important; padding: 7px 10px !important; font-size: 11px !important; gap: 6px !important; white-space: nowrap; vertical-align: middle; }
.pdf-link svg { width: 13px !important; height: 13px !important; }
</style>

<style scoped>

.page { max-width: 1080px; margin: 0 auto; padding: 40px 32px 80px; }
.page-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 22px; font-weight: 600; color: var(--text); }
.page-subtitle { font-size: 13px; color: var(--muted); margin-top: 4px; }

.dash-stats { display: flex; gap: 12px; margin-bottom: 20px; overflow-x: auto; flex-wrap: nowrap; padding-bottom: 6px; scrollbar-width: thin; scrollbar-color: var(--dim2) transparent; }
.dash-stats::-webkit-scrollbar { height: 4px; }
.dash-stats::-webkit-scrollbar-track { background: transparent; }
.dash-stats::-webkit-scrollbar-thumb { background: var(--dim2); border-radius: 2px; }
.stat-chip { font-family: 'Space Mono', monospace; font-size: 12px; letter-spacing: 0.04em; color: var(--muted); background: var(--bg2); border: 1px solid var(--dim2); border-radius: 4px; padding: 6px 14px; }
.stat-chip strong { color: var(--text); font-weight: 700; }
.stat-chip-link { color: var(--accent); text-decoration: none; border-color: var(--accent); background: rgba(77,159,255,0.08); transition: background 0.15s; }
.stat-chip-link:hover { background: rgba(77,159,255,0.16); }

.trend-section { margin-bottom: 24px; }
.trend-title { font-family: 'Space Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 10px; }
.trend-charts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
.trend-card { background: var(--bg2); border: 1px solid var(--border); padding: 16px 20px; min-width: 0; }
.trend-domain { font-size: 12px; color: var(--text); font-weight: 500; margin-bottom: 6px; }

.cat-sparks { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin-top: 10px; border-top: 1px solid var(--border); padding-top: 10px; }
.cat-spark { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 0 4px; }
.cat-spark-label { font-family: 'Space Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
.cat-spark-svg { width: 100%; height: 24px; display: block; overflow: visible; }
.cat-spark-score { font-family: 'Space Mono', monospace; font-size: 10px; font-weight: 700; }

.stat-chip-diff { color: #b07bff; border-color: #b07bff; background: rgba(176,123,255,0.08); }
.stat-chip-diff:hover { background: rgba(176,123,255,0.16); }

.sched-section { margin-bottom: 24px; background: var(--bg2); border: 1px solid var(--border); padding: 16px 20px; }
.sched-title { font-family: 'Space Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 16px; }
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

.table-label { font-family: 'Space Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 10px; }
.reports-table { width: 100%; border-collapse: collapse; }
.reports-table thead tr { border-bottom: 1px solid var(--border); }
.reports-table th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); padding: 0 12px 12px; }
.reports-table th:first-child { padding-left: 0; }
.reports-table th:last-child { padding-right: 0; }
.reports-table tbody tr { border-bottom: 1px solid var(--border); border-left: 2px solid transparent; transition: background 0.1s, border-left-color 0.15s; }
.reports-table tbody tr:hover { background: var(--bg2); border-left-color: var(--accent); }
.reports-table td { padding: 14px 12px; vertical-align: middle; line-height: 1; }
.reports-table td > span, .reports-table td > a, .reports-table td > button, .reports-table td > div { vertical-align: middle; }
.reports-table td:first-child { padding-left: 0; }
.reports-table td:last-child { padding-right: 0; }

.type-badge { font-family: 'Space Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; white-space: nowrap; }
.report-url { font-size: 13px; color: var(--text); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.url-expand-btn { display: inline-block; margin-top: 4px; font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.04em; color: var(--muted); background: none; border: none; padding: 0; cursor: pointer; }
.url-expand-btn:hover { color: var(--accent); }
.url-expand-list { margin-top: 6px; display: flex; flex-direction: column; gap: 3px; }
.url-expand-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; max-width: 300px; }
.url-expand-url { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.url-expand-score { font-family: 'Space Mono', monospace; font-size: 10px; font-weight: 700; flex-shrink: 0; }
.report-grade { font-family: 'Space Mono', monospace; font-size: 18px; font-weight: 700; line-height: normal; vertical-align: middle; }
.report-score { font-family: 'Space Mono', monospace; font-size: 12px; color: var(--muted); }
.score-delta { font-family: 'Space Mono', monospace; font-size: 10px; margin-left: 6px; padding: 1px 5px; border-radius: 3px; }
.delta-up { color: var(--pass); background: rgba(52,211,153,0.1); }
.delta-down { color: var(--fail); background: rgba(255,68,85,0.1); }
.report-date { font-size: 12px; color: var(--muted); white-space: nowrap; }
.no-pdf { font-size: 12px; color: var(--dim2); }

.btn-view { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--pass); background: none; border: 1px solid var(--pass); border-radius: 4px; padding: 4px 10px; cursor: pointer; letter-spacing: 0.04em; text-decoration: none; white-space: nowrap; transition: background 0.15s; }
.btn-view:hover { background: rgba(52,211,153,0.08); }
.btn-view-disabled { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); border: none; padding: 4px 10px; }
.btn-share { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--accent); background: none; border: 1px solid var(--accent); border-radius: 4px; padding: 4px 10px; cursor: pointer; letter-spacing: 0.04em; transition: color 0.15s, border-color 0.15s, background 0.15s; white-space: nowrap; }
.btn-share:hover { background: rgba(77,159,255,0.08); }
.btn-share:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-delete { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); background: none; border: 1px solid var(--border); border-radius: 4px; padding: 4px 10px; cursor: pointer; letter-spacing: 0.04em; transition: color 0.15s, border-color 0.15s; }
.btn-delete:hover { color: var(--fail); border-color: var(--fail); }
.del-confirm { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); letter-spacing: 0.04em; }
.del-confirm-btns { display: flex; gap: 6px; }
.btn-del-yes { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--fail); background: none; border: 1px solid rgba(255,68,85,0.4); border-radius: 4px; padding: 2px 10px; cursor: pointer; letter-spacing: 0.04em; transition: background 0.15s, border-color 0.15s; }
.btn-del-yes:hover { background: rgba(255,68,85,0.1); border-color: var(--fail); }
.btn-del-no { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); background: none; border: 1px solid var(--border); border-radius: 4px; padding: 2px 10px; cursor: pointer; letter-spacing: 0.04em; transition: color 0.15s, border-color 0.15s; }
.btn-del-no:hover { color: var(--text); border-color: var(--dim2); }
.del-status { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); }
.del-error { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--fail); }
.del-col { width: 110px; }
.del-cell { white-space: nowrap; }

.empty-state { text-align: center; padding: 80px 24px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg2); }
.empty-icon { margin-bottom: 16px; color: var(--muted); opacity: 0.5; }
.empty-title { font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
.empty-body { font-size: 13px; color: var(--muted); margin-bottom: 24px; }
.btn-new-audit { font-family: 'Space Mono', monospace; font-size: 12px; color: var(--accent); background: none; border: 1px solid var(--accent); border-radius: 4px; padding: 8px 16px; cursor: pointer; text-decoration: none; }
.btn-new-audit:hover { background: var(--accent); color: #fff; }
</style>
