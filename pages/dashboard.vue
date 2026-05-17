<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useHead({
  title: 'Dashboard — SearchGrade',
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
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min
  // Enforce a minimum effective range of 10 pts so tiny variations
  // don't get amplified to fill the full SVG height
  const effectiveRange = Math.max(range, 10)
  const mid = (min + max) / 2
  const effectiveMin = mid - effectiveRange / 2
  return vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w
    const y = h - ((v - effectiveMin) / effectiveRange) * h
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
      const overallVals = chronological.map(r => r.score)
      const overallLatest = overallVals.length > 0 ? overallVals[overallVals.length - 1] : null
      const overallDelta = overallVals.length >= 2 ? overallVals[overallVals.length - 1] - overallVals[overallVals.length - 2] : null
      const overallPoints = sparkPoints(overallVals, 200, 32)
      const catSeries = CAT_SPARK.map(c => {
        const vals = chronological
          .map(r => r.catScores?.[c.key] ?? null)
          .filter(v => v !== null)
        return {
          key: c.key,
          label: c.label,
          color: c.color,
          vals,
          points: sparkPoints(vals, 80, 24),
          latest: vals.length > 0 ? vals[vals.length - 1] : null,
          hasSeries: vals.length >= 2,
          delta: vals.length >= 2 ? vals[vals.length - 1] - vals[vals.length - 2] : null,
        }
      })
      return {
        host,
        items: chronological,
        compareUrl: `/compare?a=${items[1].id}&b=${items[0].id}`,
        overallLatest,
        overallDelta,
        overallPoints,
        catSeries,
      }
    })
})

const { gradeColor } = useGradeColor()

function visibilityScoreColor(score: number) {
  if (score == null) return 'color:var(--muted)'
  if (score >= 70) return 'color:#34d399'
  if (score >= 40) return 'color:#ffb800'
  return 'color:#ff4455'
}

function weeklyMentionRate(domain: string) {
  const weekly = aiVisibility.value[domain]?.weekly
  if (!weekly?.length) return null
  const last = weekly[weekly.length - 1]
  return last?.mentionRate ?? null
}

function visibilitySparkPoints(weekly: any[]) {
  if (!weekly || weekly.length < 2) return ''
  const vals = weekly.map(w => w.mentionRate)
  return vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * 100
    const y = 28 - (v / 100) * 24
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

// AI Visibility
const aiVisibilityDomains  = ref<string[]>([])
const aiVisibility         = ref<Record<string, any>>({})   // domain → { scans, mentionRate, weekly }
const aiVisibilityScan     = ref<Record<string, boolean>>({})  // domain → scanning
const aiVisibilityError    = ref<Record<string, string>>({})
const expandedAivQuery     = ref<Record<string, boolean>>({})  // "domain-i" → expanded

function toggleAivQuery(domain: string, i: number) {
  const k = `${domain}-${i}`
  expandedAivQuery.value = { ...expandedAivQuery.value, [k]: !expandedAivQuery.value[k] }
}

function initAiVisibilityDomains() {
  // Derive unique domains from page-audit reports
  const seen = new Set<string>()
  for (const r of reports.value) {
    if (r.audit_type !== 'page') continue
    try {
      const host = new URL(r.url).hostname.replace(/^www\./, '')
      if (!seen.has(host)) { seen.add(host); aiVisibilityDomains.value.push(host) }
    } catch {}
  }
}

async function loadVisibilityHistory(domain: string) {
  try {
    const data: any = await $fetch(`/api/ai-visibility-history?domain=${encodeURIComponent(domain)}`)
    // Preserve any in-memory latestScan from a just-completed scan, otherwise use the one from DB.
    // latestScan includes scans, mentionRate, categoryScores, inferredCategory, platforms.
    const existing = aiVisibility.value[domain]
    aiVisibility.value = {
      ...aiVisibility.value,
      [domain]: {
        scans: data.scans,
        weekly: data.weekly,
        latestScan: existing?.latestScan ?? data.latestScan,
      },
    }
  } catch {}
}

async function runVisibilityScan(domain: string) {
  // Find a URL for this domain from reports
  const rep = reports.value.find(r => {
    try { return new URL(r.url).hostname.replace(/^www\./, '') === domain } catch { return false }
  })
  if (!rep) return
  aiVisibilityScan.value = { ...aiVisibilityScan.value, [domain]: true }
  aiVisibilityError.value = { ...aiVisibilityError.value, [domain]: '' }
  try {
    const data: any = await $fetch('/api/ai-visibility', { method: 'POST', body: { url: rep.url } })
    // Reload history to reflect new scans
    await loadVisibilityHistory(domain)
    aiVisibility.value = { ...aiVisibility.value, [domain]: { ...(aiVisibility.value[domain] || {}), latestScan: data } }
  } catch (e: any) {
    aiVisibilityError.value = { ...aiVisibilityError.value, [domain]: e.data?.message || 'Scan failed.' }
  } finally {
    aiVisibilityScan.value = { ...aiVisibilityScan.value, [domain]: false }
  }
}

const expandedId    = ref(null)
const expandedChart = ref(null)
const expandedTab   = ref<Record<string, string>>({})  // host → 'score' | 'cwv'
const cwvHistory    = ref<Record<string, any[]>>({})   // host → rows
const _cwvChartInstances = new Map()
const _chartInstances = new Map()

function getTab(host: string) { return expandedTab.value[host] || 'score' }

async function switchTab(host: string, tab: string) {
  expandedTab.value = { ...expandedTab.value, [host]: tab }
  if (tab === 'cwv') {
    await loadCwvHistory(host)
    await nextTick()
    buildCwvChart(host)
  } else {
    await nextTick()
    const group = trendGroups.value.find(g => g.host === host)
    if (group) buildExpandedChart(group)
  }
}

async function loadCwvHistory(host: string) {
  if (cwvHistory.value[host]) return  // already loaded
  const group = trendGroups.value.find(g => g.host === host)
  if (!group) return
  const url = group.items[group.items.length - 1]?.url
  if (!url) return
  try {
    const rows = await $fetch(`/api/cwv-history?url=${encodeURIComponent(url)}`)
    cwvHistory.value = { ...cwvHistory.value, [host]: rows as any[] }
  } catch {}
}

function buildCwvChart(host: string) {
  if (typeof window === 'undefined' || !window.Chart) return
  const canvasId = 'cwvchart-' + host.replace(/\./g, '-')
  const canvas = document.getElementById(canvasId)
  if (!canvas) return
  if (_cwvChartInstances.has(host)) { _cwvChartInstances.get(host).destroy(); _cwvChartInstances.delete(host) }
  const rows = cwvHistory.value[host] || []
  if (!rows.length) return
  const labels = rows.map((r: any) => new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
  const makeDs = (label: string, data: number[], color: string) => ({
    label, data, borderColor: color, backgroundColor: color + '14',
    pointBackgroundColor: color, pointBorderColor: color,
    pointRadius: 4, borderWidth: 2, fill: false, tension: 0.3, clip: false,
  })
  const datasets = [
    makeDs('LCP (s)', rows.map((r: any) => r.lcp_ms != null ? +(r.lcp_ms / 1000).toFixed(2) : null), '#7baeff'),
    makeDs('CLS (×10)', rows.map((r: any) => r.cls != null ? +(r.cls * 10).toFixed(3) : null), '#b07bff'),
    makeDs('PSI Score', rows.map((r: any) => r.performance_score), '#34d399'),
  ]
  const instance = new window.Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { left: 8, right: 8, top: 6, bottom: 4 } },
      plugins: {
        legend: { display: true, labels: { color: '#8892a4', font: { family: "'Space Mono', monospace", size: 9 }, boxWidth: 10, padding: 12 } },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}` },
          backgroundColor: '#111214', borderColor: '#1e2025', borderWidth: 1,
          titleColor: '#8892a4', bodyColor: '#e4e6ea',
        },
      },
      scales: {
        x: { grid: { color: '#1e2025' }, ticks: { color: '#8892a4', font: { family: "'Space Mono', monospace", size: 9 } } },
        y: { grid: { color: '#1e2025' }, ticks: { color: '#8892a4', font: { family: "'Space Mono', monospace", size: 9 } } },
      },
    },
  })
  _cwvChartInstances.set(host, instance)
}

function buildExpandedChart(group) {
  if (typeof window === 'undefined' || !window.Chart) return
  const canvasId = 'fullchart-' + group.host.replace(/\./g, '-')
  const canvas = document.getElementById(canvasId)
  if (!canvas) return
  // Destroy existing instance to avoid Chart.js "canvas already in use" error
  if (_chartInstances.has(group.host)) {
    _chartInstances.get(group.host).destroy()
    _chartInstances.delete(group.host)
  }
  const labels = group.items.map(r => r.dateFormatted)
  const makeDataset = (label, data, color) => ({
    label, data,
    borderColor: color, backgroundColor: color + '14',
    pointBackgroundColor: color, pointBorderColor: color,
    pointRadius: 4, pointHoverRadius: 5,
    borderWidth: 2, fill: false, tension: 0.3, clip: false,
  })
  const datasets = [
    makeDataset('Total',     group.items.map(r => r.score),                 '#4d9fff'),
    makeDataset('Technical', group.items.map(r => r.catScores?.technical ?? null), '#8892a4'),
    makeDataset('Content',   group.items.map(r => r.catScores?.content   ?? null), '#e8a87c'),
    makeDataset('AEO',       group.items.map(r => r.catScores?.aeo       ?? null), '#7baeff'),
    makeDataset('GEO',       group.items.map(r => r.catScores?.geo       ?? null), '#b07bff'),
  ]
  const instance = new window.Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { left: 8, right: 8, top: 6, bottom: 4 } },
      plugins: {
        legend: { display: true, labels: { color: '#8892a4', font: { family: "'Space Mono', monospace", size: 9 }, boxWidth: 10, padding: 12 } },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}/100` },
          backgroundColor: '#111214', borderColor: '#1e2025', borderWidth: 1,
          titleColor: '#8892a4', bodyColor: '#e4e6ea',
        },
      },
      scales: {
        x: { grid: { color: '#1e2025' }, ticks: { color: '#8892a4', font: { family: "'Space Mono', monospace", size: 9 } } },
        y: { min: 0, max: 100, grid: { color: '#1e2025' }, ticks: { color: '#8892a4', font: { family: "'Space Mono', monospace", size: 9 }, stepSize: 25 } },
      },
    },
  })
  _chartInstances.set(group.host, instance)
}

watch(expandedChart, async (host) => {
  if (!host) return
  await nextTick()
  const tab = getTab(host)
  if (tab === 'cwv') {
    await loadCwvHistory(host)
    await nextTick()
    buildCwvChart(host)
  } else {
    const group = trendGroups.value.find(g => g.host === host)
    if (!group) return
    const waitAndBuild = (attempts) => {
      if (window.Chart) { buildExpandedChart(group); return }
      if (attempts > 0) setTimeout(() => waitAndBuild(attempts - 1), 200)
    }
    waitAndBuild(10)
  }
})

// Collapsible sections
const showAllTrends  = ref(false)
const showAllAiv     = ref(false)
const expandedAivDomain = ref<Record<string, boolean>>({})

function toggleAivDomain(domain: string) {
  expandedAivDomain.value = { ...expandedAivDomain.value, [domain]: !expandedAivDomain.value[domain] }
}

const TRENDS_PAGE = 4
const AIV_PAGE    = 6

const visibleTrendGroups = computed(() =>
  showAllTrends.value ? trendGroups.value : trendGroups.value.slice(0, TRENDS_PAGE)
)

const visibleAivDomains = computed(() =>
  showAllAiv.value ? aiVisibilityDomains.value : aiVisibilityDomains.value.slice(0, AIV_PAGE)
)

// Report table filters
const filterUrl   = ref('')
const filterType  = ref('all')
const filterGrade = ref('all')
const filterDate  = ref('all')
const filterTags  = ref(new Set<string>())

const allTags = computed(() => [...new Set(reports.value.flatMap(r => r.tags || []))])

const sortCol = ref<string | null>(null)
const sortDir = ref<1 | -1>(1)

function toggleSort(col: string) {
  if (sortCol.value === col) { sortDir.value = sortDir.value === 1 ? -1 : 1 }
  else { sortCol.value = col; sortDir.value = -1 }
  currentPage.value = 1
}

function sortArrow(col: string) {
  if (sortCol.value !== col) return ' ↕'
  return sortDir.value === 1 ? ' ↑' : ' ↓'
}

const filteredReports = computed(() => {
  const now = Date.now()
  const cutoff7d  = now - 7  * 24 * 60 * 60 * 1000
  const cutoff30d = now - 30 * 24 * 60 * 60 * 1000
  const list = reports.value.filter(r => {
    if (filterUrl.value && !r.url.toLowerCase().includes(filterUrl.value.toLowerCase())) return false
    if (filterType.value !== 'all' && r.audit_type !== filterType.value) return false
    if (filterGrade.value !== 'all' && r.grade !== filterGrade.value) return false
    if (filterDate.value === '7d'  && new Date(r.created_at).getTime() < cutoff7d)  return false
    if (filterDate.value === '30d' && new Date(r.created_at).getTime() < cutoff30d) return false
    if (filterTags.value.size > 0 && ![...filterTags.value].every(t => (r.tags || []).includes(t))) return false
    return true
  })
  if (!sortCol.value) return list
  return [...list].sort((a, b) => {
    if (sortCol.value === 'url')   return (a.url ?? '').localeCompare(b.url ?? '') * sortDir.value
    if (sortCol.value === 'grade') return ((a.grade ?? 'Z').localeCompare(b.grade ?? 'Z')) * sortDir.value
    if (sortCol.value === 'score') return ((a.score ?? -1) - (b.score ?? -1)) * sortDir.value
    if (sortCol.value === 'date')  return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * sortDir.value
    return 0
  })
})

// Tags
const addingTagId  = ref<number | null>(null)
const tagInputVal  = ref('')

async function saveTag(reportId: number, tag: string) {
  const report = reports.value.find(r => r.id === reportId)
  if (!report) return
  const existing = report.tags || []
  if (existing.includes(tag) || !tag.trim()) return
  const newTags = [...existing, tag.trim()]
  try {
    await $fetch(`/api/reports/${reportId}/tags`, { method: 'PATCH', body: { tags: newTags } })
    report.tags = newTags
  } catch {}
}

async function removeTag(reportId: number, tag: string) {
  const report = reports.value.find(r => r.id === reportId)
  if (!report) return
  const newTags = (report.tags || []).filter((t: string) => t !== tag)
  try {
    await $fetch(`/api/reports/${reportId}/tags`, { method: 'PATCH', body: { tags: newTags } })
    report.tags = newTags
  } catch {}
}

function onTagInputKey(event: KeyboardEvent, reportId: number) {
  if (event.key === 'Enter') {
    saveTag(reportId, tagInputVal.value)
    tagInputVal.value = ''
    addingTagId.value = null
  } else if (event.key === 'Escape') {
    tagInputVal.value = ''
    addingTagId.value = null
  }
}

// Batch select
const selectedReports = ref(new Set<number>())

function toggleSelect(id: number) {
  const next = new Set(selectedReports.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  selectedReports.value = next
}

const allVisibleSelected = computed(() =>
  visibleReports.value.length > 0 && visibleReports.value.every(r => selectedReports.value.has(r.id))
)

function toggleSelectAll() {
  if (allVisibleSelected.value) {
    selectedReports.value = new Set()
  } else {
    selectedReports.value = new Set(visibleReports.value.map(r => r.id))
  }
}

watch(filteredReports, () => { selectedReports.value = new Set(); currentPage.value = 1 })

const batchDeleting = ref(false)

async function deleteSelected() {
  if (!selectedReports.value.size) return
  const n = selectedReports.value.size
  if (!window.confirm(`Delete ${n} report${n !== 1 ? 's' : ''}? This cannot be undone.`)) return
  batchDeleting.value = true
  const ids = [...selectedReports.value]
  for (const id of ids) {
    try {
      await $fetch(`/api/reports/${id}`, { method: 'DELETE' })
      dashData.value.reports = dashData.value.reports.filter(r => r.id !== id)
    } catch {}
  }
  selectedReports.value = new Set()
  batchDeleting.value = false
}

function exportSelectedCsv() {
  const rows = reports.value.filter(r => selectedReports.value.has(r.id))
  const header = ['id', 'url', 'type', 'grade', 'score', 'date']
  const lines = [
    header.join(','),
    ...rows.map(r => [r.id, `"${r.url.replace(/"/g,'""')}"`, r.audit_type, r.grade || '', r.score ?? '', r.dateFormatted].join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'searchgrade-reports.csv'
  a.click()
}

const PAGE_SIZE = 15
const currentPage      = ref(1)
const totalPages       = computed(() => Math.max(1, Math.ceil(filteredReports.value.length / PAGE_SIZE)))
const paginatedReports = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredReports.value.slice(start, start + PAGE_SIZE)
})
const pageInputError = ref(false)

function goToPage(n: number) {
  const p = Math.round(n)
  if (isNaN(p) || p < 1 || p > totalPages.value) {
    pageInputError.value = true
    setTimeout(() => { pageInputError.value = false }, 1200)
    return
  }
  currentPage.value = p
}

function onPageInputKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    goToPage(parseInt((e.target as HTMLInputElement).value));
    (e.target as HTMLInputElement).value = ''
  } else if (e.key === 'ArrowLeft') { e.preventDefault(); goToPage(currentPage.value - 1) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); goToPage(currentPage.value + 1) }
}

const visiblePageNums = computed<(number | '...')[]>(() => {
  const total = totalPages.value
  const cur = currentPage.value
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = []
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= cur - 2 && i <= cur + 2)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }
  return pages
})

// Alias for batch select compatibility
const visibleReports = paginatedReports

const deletingId = ref(null)
const deletingConfirmed = ref(null)

async function confirmDeleteReport(reportId) {
  deletingConfirmed.value = reportId
  deletingId.value = null
  try {
    await $fetch(`/api/reports/${reportId}`, { method: 'DELETE' })
    dashData.value.reports = dashData.value.reports.filter(r => r.id !== reportId)
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

onMounted(async () => {
  try {
    dashData.value = await $fetch('/api/dashboard-data')
  } catch {
    // auth middleware will redirect if unauthenticated
  }
  initAiVisibilityDomains()
  // Pre-load visibility history for all tracked domains
  for (const domain of aiVisibilityDomains.value) {
    loadVisibilityHistory(domain)
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
          <div class="page-subtitle">Your saved audits from SearchGrade</div>
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
          <a href="/account#scheduled" class="stat-chip stat-chip-link">⏱ Scheduled Audits</a>
        </div>

        <!-- Trend charts -->
        <div v-if="trendGroups.length > 0" class="trend-section">
          <div class="trend-title">Score Trends</div>
          <div class="trend-charts">
            <div v-for="group in visibleTrendGroups" :key="group.host" class="trend-card">
              <div class="trend-domain-row" @click="expandedChart = expandedChart === group.host ? null : group.host">
                <div class="trend-domain">{{ group.host }}</div>
                <span class="trend-expand-toggle">{{ expandedChart === group.host ? '▾ collapse' : '▸ full chart' }}</span>
              </div>
              <!-- Overall score strip -->
              <div class="trend-overall-strip">
                <div class="trend-overall-left">
                  <span class="trend-overall-score">{{ group.overallLatest ?? '—' }}</span>
                  <span
                    v-if="group.overallDelta !== null"
                    class="trend-delta"
                    :class="group.overallDelta > 0 ? 'delta-up' : group.overallDelta < 0 ? 'delta-down' : 'delta-flat'"
                  >{{ group.overallDelta > 0 ? '+' : '' }}{{ group.overallDelta }}</span>
                </div>
                <svg class="trend-overall-spark" viewBox="0 0 200 32" preserveAspectRatio="none">
                  <polyline v-if="group.overallPoints" :points="group.overallPoints" stroke="#4d9fff" fill="none" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
                </svg>
              </div>
              <!-- 2×2 category KPI grid -->
              <div class="cat-kpi-grid">
                <div v-for="cat in group.catSeries" :key="cat.key" class="cat-kpi-cell">
                  <div class="cat-kpi-top">
                    <span class="cat-kpi-label" :style="`color:${cat.color}`">{{ cat.label }}</span>
                    <span class="cat-kpi-score" :style="`color:${cat.color}`">{{ cat.latest ?? '—' }}</span>
                    <span
                      v-if="cat.delta !== null"
                      class="trend-delta"
                      :class="cat.delta > 0 ? 'delta-up' : cat.delta < 0 ? 'delta-down' : 'delta-flat'"
                    >{{ cat.delta > 0 ? '+' : '' }}{{ cat.delta }}</span>
                  </div>
                  <svg class="cat-kpi-spark" viewBox="0 0 80 36" preserveAspectRatio="none">
                    <polyline v-if="cat.hasSeries" :points="sparkPoints(cat.vals, 80, 36)" :stroke="cat.color" fill="none" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
                    <line v-else x1="0" y1="18" x2="80" y2="18" :stroke="cat.color" stroke-width="1" stroke-dasharray="3,3" opacity="0.35"/>
                  </svg>
                </div>
              </div>
              <!-- Expanded full category chart + CWV tab -->
              <div v-if="expandedChart === group.host" class="chart-expanded">
                <div class="chart-tabs">
                  <button class="chart-tab" :class="{ active: getTab(group.host) === 'score' }" @click="switchTab(group.host, 'score')">Score</button>
                  <button class="chart-tab" :class="{ active: getTab(group.host) === 'cwv' }" @click="switchTab(group.host, 'cwv')">CWV</button>
                </div>
                <div v-if="getTab(group.host) === 'score'" style="position:relative;height:200px;width:100%">
                  <canvas :id="'fullchart-' + group.host.replace(/\./g, '-')"></canvas>
                </div>
                <div v-if="getTab(group.host) === 'cwv'" style="position:relative;height:200px;width:100%">
                  <canvas :id="'cwvchart-' + group.host.replace(/\./g, '-')"></canvas>
                  <div v-if="!cwvHistory[group.host] || !cwvHistory[group.host].length" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--muted)">No CWV data yet — audit this site again to collect data.</div>
                </div>
              </div>
            </div>
          </div>
          <button v-if="trendGroups.length > TRENDS_PAGE && !showAllTrends" class="expand-btn" @click="showAllTrends = true">
            Show {{ trendGroups.length - TRENDS_PAGE }} more domain{{ trendGroups.length - TRENDS_PAGE !== 1 ? 's' : '' }} ▸
          </button>
          <button v-else-if="showAllTrends && trendGroups.length > TRENDS_PAGE" class="expand-btn" @click="showAllTrends = false">
            Show fewer ▴
          </button>
        </div>

        <!-- AI Visibility -->
        <div v-if="aiVisibilityDomains.length > 0" class="trend-section">
          <div class="trend-title">AI Visibility</div>
          <div class="aiv-cards">
            <div v-for="domain in visibleAivDomains" :key="domain" class="aiv-card">
              <div class="aiv-header">
                <div class="aiv-domain">{{ domain }}</div>
                <button class="chart-tab" :disabled="aiVisibilityScan[domain]" @click="runVisibilityScan(domain)">
                  {{ aiVisibilityScan[domain] ? 'Scanning…' : aiVisibility[domain]?.latestScan ? 'Rescan →' : 'Run Scan →' }}
                </button>
              </div>

              <!-- Latest scan results -->
              <template v-if="aiVisibility[domain]?.latestScan || aiVisibility[domain]?.scans?.length">
                <!-- Score block -->
                <div class="aiv-score-block">
                  <div class="aiv-score-main">
                    <div class="aiv-score-label">AI Visibility Score</div>
                    <div class="aiv-score-num" :style="visibilityScoreColor(aiVisibility[domain]?.latestScan?.mentionRate ?? weeklyMentionRate(domain))">
                      {{ aiVisibility[domain]?.latestScan?.mentionRate ?? weeklyMentionRate(domain) ?? '—' }}
                    </div>
                  </div>
                  <!-- Category sub-scores -->
                  <div v-if="aiVisibility[domain]?.latestScan?.categoryScores" class="aiv-cat-scores">
                    <div class="aiv-cat-score">
                      <span class="aiv-cat-label">Awareness</span>
                      <span class="aiv-cat-val" :style="visibilityScoreColor(aiVisibility[domain].latestScan.categoryScores.awareness)">
                        {{ aiVisibility[domain].latestScan.categoryScores.awareness ?? '—' }}
                      </span>
                    </div>
                    <div class="aiv-cat-sep">·</div>
                    <div class="aiv-cat-score">
                      <span class="aiv-cat-label">Discovery</span>
                      <span class="aiv-cat-val" :style="visibilityScoreColor(aiVisibility[domain].latestScan.categoryScores.discovery)">
                        {{ aiVisibility[domain].latestScan.categoryScores.discovery ?? '—' }}
                      </span>
                    </div>
                    <div class="aiv-cat-sep">·</div>
                    <div class="aiv-cat-score">
                      <span class="aiv-cat-label">Recommendation</span>
                      <span class="aiv-cat-val" :style="visibilityScoreColor(aiVisibility[domain].latestScan.categoryScores.recommendation)">
                        {{ aiVisibility[domain].latestScan.categoryScores.recommendation ?? '—' }}
                      </span>
                    </div>
                  </div>
                  <div v-if="aiVisibility[domain]?.latestScan?.inferredCategory" class="aiv-inferred-cat">
                    Detected as: {{ aiVisibility[domain].latestScan.inferredCategory }}
                  </div>
                  <!-- Per-platform breakdown (multi-platform) -->
                  <div v-if="aiVisibility[domain]?.latestScan?.platformScores && Object.keys(aiVisibility[domain].latestScan.platformScores).length > 1" class="aiv-platform-breakdown">
                    <div
                      v-for="(ps, platKey) in aiVisibility[domain].latestScan.platformScores"
                      :key="platKey"
                      class="aiv-platform-row"
                    >
                      <span class="aiv-platform-label">{{ ps.label }}</span>
                      <div class="aiv-platform-bar-wrap">
                        <div class="aiv-platform-bar" :style="{ width: ps.mentionRate + '%', background: ps.mentionRate >= 70 ? 'var(--pass)' : ps.mentionRate >= 40 ? 'var(--warn)' : 'var(--fail)' }"></div>
                      </div>
                      <span class="aiv-platform-pct" :style="{ color: ps.mentionRate >= 70 ? 'var(--pass)' : ps.mentionRate >= 40 ? 'var(--warn)' : 'var(--fail)' }">{{ ps.mentionRate }}%</span>
                    </div>
                  </div>
                  <div v-else class="aiv-score-meta">
                    <span>via {{ aiVisibility[domain]?.latestScan?.platforms?.[0] ?? 'AI' }}</span>
                    <span class="aiv-score-note">· trend matters more than snapshots</span>
                  </div>
                </div>

                <!-- Per-query results grouped by category — collapsed by default -->
                <div v-if="aiVisibility[domain]?.latestScan?.scans?.length" class="aiv-queries-wrap">
                  <button class="aiv-queries-toggle" @click="toggleAivDomain(domain)">
                    {{ expandedAivDomain[domain] ? '▾ Hide queries' : `▸ View queries (${aiVisibility[domain].latestScan.scans.length})` }}
                  </button>
                  <div v-if="expandedAivDomain[domain]" class="aiv-queries">
                    <template v-for="(s, i) in aiVisibility[domain].latestScan.scans" :key="i">
                      <div
                        v-if="s.query_category && (i === 0 || s.query_category !== aiVisibility[domain].latestScan.scans[i - 1]?.query_category || s.platform !== aiVisibility[domain].latestScan.scans[i - 1]?.platform)"
                        class="aiv-cat-group-header"
                      >
                        {{ s.query_category === 'awareness' ? 'Brand Awareness' : s.query_category === 'discovery' ? 'Category Discovery' : 'Recommendation' }}
                        <span v-if="aiVisibility[domain].latestScan.platforms?.length > 1" class="aiv-cat-platform-badge">{{ aiVisibility[domain].latestScan.platformScores?.[s.platform]?.label ?? s.platform }}</span>
                      </div>
                      <div class="aiv-query-row">
                        <span class="aiv-query-icon" :class="s.mentioned ? 'aiv-yes' : 'aiv-no'">{{ s.mentioned ? '✓' : '✕' }}</span>
                        <div class="aiv-query-body">
                          <div class="aiv-query-text aiv-query-toggle" @click="toggleAivQuery(domain, i)">
                            {{ s.query }}
                            <span class="aiv-toggle-icon">{{ expandedAivQuery[`${domain}-${i}`] ? '▾' : '▸' }}</span>
                          </div>
                          <div v-if="expandedAivQuery[`${domain}-${i}`]" class="aiv-excerpt-full">{{ s.excerpt || 'No response captured for this query.' }}</div>
                          <span v-if="s.mentioned && s.sentiment" class="aiv-sentiment" :class="`aiv-sentiment-${s.sentiment}`">{{ s.sentiment }}</span>
                          <span v-else-if="!s.mentioned" class="aiv-sentiment aiv-sentiment-not-detected">not detected</span>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- Weekly sparkline -->
                <div v-if="aiVisibility[domain]?.weekly?.length >= 2" class="aiv-spark-row">
                  <svg class="aiv-spark" viewBox="0 0 100 28" preserveAspectRatio="none">
                    <polyline :points="visibilitySparkPoints(aiVisibility[domain].weekly)" stroke="#b07bff" fill="none" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
                  </svg>
                  <span class="aiv-spark-label">90-day trend</span>
                </div>
              </template>
              <div v-else class="aiv-empty">No scan yet — click Run Scan to check how AI models recognize your brand across 10 queries.</div>

              <div v-if="aiVisibilityError[domain]" class="aiv-error">{{ aiVisibilityError[domain] }}</div>
            </div>
          </div>
          <button v-if="aiVisibilityDomains.length > AIV_PAGE && !showAllAiv" class="expand-btn" @click="showAllAiv = true">
            Show {{ aiVisibilityDomains.length - AIV_PAGE }} more domain{{ aiVisibilityDomains.length - AIV_PAGE !== 1 ? 's' : '' }} ▸
          </button>
          <button v-else-if="showAllAiv && aiVisibilityDomains.length > AIV_PAGE" class="expand-btn" @click="showAllAiv = false">
            Show fewer ▴
          </button>
        </div>

        <div class="table-label">All Reports</div>

        <!-- Filter bar -->
        <div class="filter-bar">
          <input
            v-model="filterUrl"
            class="filter-search"
            type="text"
            placeholder="Filter by URL…"
          />
          <div class="filter-group">
            <button v-for="t in ['all','page','site','multi','bulk']" :key="t"
              class="filter-chip" :class="{ active: filterType === t }"
              @click="filterType = t">
              {{ t === 'all' ? 'All Types' : t === 'multi' ? 'Compare' : t.charAt(0).toUpperCase() + t.slice(1) }}
            </button>
          </div>
          <div class="filter-group">
            <button v-for="g in ['all','A','B','C','D','F']" :key="g"
              class="filter-chip" :class="{ active: filterGrade === g }"
              @click="filterGrade = g">
              {{ g === 'all' ? 'All Grades' : g }}
            </button>
          </div>
          <div class="filter-group">
            <button v-for="d in [['all','All Time'],['30d','Last 30d'],['7d','Last 7d']]" :key="d[0]"
              class="filter-chip" :class="{ active: filterDate === d[0] }"
              @click="filterDate = d[0]">
              {{ d[1] }}
            </button>
          </div>
          <div v-if="allTags.length > 0" class="filter-group">
            <button class="filter-chip" :class="{ active: filterTags.size === 0 }" @click="filterTags = new Set()">All Tags</button>
            <button v-for="tag in allTags" :key="tag" class="filter-chip tag-filter-chip" :class="{ active: filterTags.has(tag) }"
              @click="() => { const next = new Set(filterTags); next.has(tag) ? next.delete(tag) : next.add(tag); filterTags = next }">{{ tag }}</button>
          </div>
          <span v-if="filteredReports.length !== reports.length" class="filter-count">
            {{ filteredReports.length }} of {{ reports.length }}
          </span>
        </div>

        <!-- Pagination bar (top) -->
        <div v-if="totalPages > 1" class="pagination-bar">
          <button class="pg-arrow" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">←</button>
          <template v-for="p in visiblePageNums" :key="String(p) + '-' + currentPage">
            <span v-if="p === '...'" class="pg-ellipsis">…</span>
            <button v-else class="pg-num" :class="{ active: p === currentPage }" @click="goToPage(Number(p))">{{ p }}</button>
          </template>
          <button class="pg-arrow" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">→</button>
          <input class="pg-input" :class="{ error: pageInputError }" type="number" min="1" :max="totalPages" placeholder="go to…" @keydown="onPageInputKey" />
          <span class="pg-info">{{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(currentPage * PAGE_SIZE, filteredReports.length) }} of {{ filteredReports.length }}</span>
        </div>

        <!-- Batch action bar -->
        <div v-if="selectedReports.size > 0" class="bulk-action-bar">
          <span class="bulk-sel-count">{{ selectedReports.size }} selected</span>
          <button class="bulk-act-btn bulk-act-delete" :disabled="batchDeleting" @click="deleteSelected">
            {{ batchDeleting ? 'Deleting…' : `Delete (${selectedReports.size})` }}
          </button>
          <button class="bulk-act-btn" @click="exportSelectedCsv">Export CSV</button>
          <button class="bulk-act-clear" @click="selectedReports = new Set()">Clear</button>
        </div>

        <table class="reports-table">
          <thead>
            <tr>
              <th class="chk-col"><input type="checkbox" class="row-check" :checked="allVisibleSelected" @change="toggleSelectAll" /></th>
              <th>Type</th>
              <th class="sort-th" @click="toggleSort('url')">URL<span class="sort-arrow">{{ sortArrow('url') }}</span></th>
              <th class="sort-th" @click="toggleSort('grade')">Grade<span class="sort-arrow">{{ sortArrow('grade') }}</span></th>
              <th class="sort-th" @click="toggleSort('score')">Score<span class="sort-arrow">{{ sortArrow('score') }}</span></th>
              <th class="sort-th" @click="toggleSort('date')">Date<span class="sort-arrow">{{ sortArrow('date') }}</span></th>
              <th>View</th>
              <th>PDF</th>
              <th>Share</th>
              <th class="del-col"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredReports.length === 0">
              <td colspan="10" style="text-align:center;padding:32px;color:var(--muted);font-size:13px">No reports match your filters.</td>
            </tr>
            <tr v-for="report in visibleReports" :key="report.id" :data-report-id="report.id">
              <td class="chk-col"><input type="checkbox" class="row-check" :checked="selectedReports.has(report.id)" @change="toggleSelect(report.id)" /></td>
              <td>
                <span
                  class="type-badge"
                  :style="`color:${report.typeColor};border:1px solid ${report.typeColor}22;background:${report.typeColor}11;`"
                >{{ report.typeLabel }}</span>
              </td>
              <td>
                <div class="report-url" :title="report.url">
                  {{ report.url }}
                  <span v-if="report.has_decay" class="decay-badge" title="Content Decay detected — some pages show declining impressions">⚠ Content Decay</span>
                </div>
                <div v-if="report.notes_preview" class="note-preview" :title="report.notes_preview">{{ report.notes_preview.length >= 51 ? report.notes_preview.slice(0, 50) + '…' : report.notes_preview }}</div>
                <!-- Tag chips -->
                <div v-if="(report.tags && report.tags.length) || addingTagId === report.id" class="tag-row">
                  <span v-for="tag in (report.tags || [])" :key="tag" class="tag-chip">
                    {{ tag }}<button class="tag-remove" @click="removeTag(report.id, tag)">✕</button>
                  </span>
                </div>
                <div class="tag-add-row">
                  <template v-if="addingTagId === report.id">
                    <input
                      ref="tagInputRef"
                      v-model="tagInputVal"
                      class="tag-input"
                      type="text"
                      placeholder="tag name"
                      maxlength="20"
                      @keydown="onTagInputKey($event, report.id)"
                      @blur="addingTagId = null; tagInputVal = ''"
                    />
                  </template>
                  <button v-else class="tag-add-btn" @click="addingTagId = report.id; tagInputVal = ''">+ tag</button>
                </div>
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
                <a v-if="report.pdf_filename" :href="`/api/reports/${report.id}/download`" class="pdf-link in" title="Download PDF">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                </a>
                <span v-else class="no-pdf">—</span>
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
                  <span>Are you sure?</span>
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

.page { max-width: min(1400px, calc(100vw - 64px)); margin: 0 auto; padding: 40px 32px 80px; }
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
.trend-domain-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; cursor: pointer; user-select: none; }
.trend-domain-row:hover .trend-domain { color: var(--accent); }
.trend-domain { font-size: 12px; color: var(--text); font-weight: 500; transition: color 0.15s; }
.trend-expand-toggle { font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.04em; color: var(--muted); white-space: nowrap; }
.chart-expanded { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px; }
.chart-tabs { display: flex; gap: 6px; margin-bottom: 10px; }
.chart-tab { font-family: 'Space Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; background: none; border: 1px solid var(--border); border-radius: 4px; color: var(--muted); cursor: pointer; padding: 3px 10px; transition: border-color 0.15s, color 0.15s; }
.chart-tab.active { border-color: var(--accent); color: var(--accent); background: rgba(77,159,255,0.08); }
.chart-tab:hover:not(.active) { border-color: var(--dim2); color: var(--text); }

/* Overall score strip */
.trend-overall-strip { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.trend-overall-left { display: flex; align-items: baseline; gap: 6px; flex-shrink: 0; }
.trend-overall-score { font-family: 'Space Mono', monospace; font-size: 22px; font-weight: 700; color: var(--text); }
.trend-overall-spark { flex: 1; height: 32px; display: block; overflow: visible; }
/* Delta badges */
.trend-delta { font-family: 'Space Mono', monospace; font-size: 10px; font-weight: 700; }
.delta-up   { color: #34d399; }
.delta-down { color: #ff4455; }
.delta-flat { color: var(--muted); }
/* 2×2 category KPI grid */
.cat-kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; border-top: 1px solid var(--border); padding-top: 10px; }
.cat-kpi-cell { background: var(--bg); border: 1px solid var(--border); padding: 8px 10px; min-width: 0; }
.cat-kpi-top { display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; }
.cat-kpi-label { font-family: 'Space Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; }
.cat-kpi-score { font-family: 'Space Mono', monospace; font-size: 16px; font-weight: 700; }
.cat-kpi-spark { width: 100%; height: 36px; display: block; overflow: visible; }

/* AI Visibility */
.aiv-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
.aiv-card { background: var(--bg2); border: 1px solid var(--border); border-left: 3px solid #b07bff; padding: 16px 20px; }
.aiv-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.aiv-domain { font-size: 13px; font-weight: 600; color: var(--text); }

.aiv-score-block { margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.aiv-score-main { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }
.aiv-score-label { font-family: 'Space Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.aiv-score-num { font-family: 'Space Mono', monospace; font-size: 32px; font-weight: 700; line-height: 1; }
.aiv-cat-scores { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
.aiv-cat-score { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.aiv-cat-label { font-family: 'Space Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.aiv-cat-val { font-family: 'Space Mono', monospace; font-size: 13px; font-weight: 700; }
.aiv-cat-sep { font-size: 12px; color: var(--border); align-self: center; }
.aiv-inferred-cat { font-size: 11px; color: var(--muted); margin-bottom: 4px; }
.aiv-score-meta { display: flex; align-items: center; gap: 4px; font-family: 'Space Mono', monospace; font-size: 9px; color: var(--muted); }
.aiv-platform-breakdown { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
.aiv-platform-row { display: flex; align-items: center; gap: 8px; }
.aiv-platform-label { font-family: 'Space Mono', monospace; font-size: 9px; color: var(--muted); width: 88px; flex-shrink: 0; }
.aiv-platform-bar-wrap { flex: 1; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
.aiv-platform-bar { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
.aiv-platform-pct { font-family: 'Space Mono', monospace; font-size: 9px; width: 28px; text-align: right; flex-shrink: 0; }
.aiv-score-note { opacity: 0.7; }

.aiv-queries-wrap { margin-bottom: 8px; }
.aiv-queries-toggle { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.04em; color: var(--muted); background: none; border: none; padding: 0; cursor: pointer; margin-bottom: 8px; }
.aiv-queries-toggle:hover { color: var(--accent); }
.aiv-queries { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.aiv-cat-group-header { font-family: 'Space Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); margin-top: 8px; margin-bottom: 2px; opacity: 0.7; display: flex; align-items: center; gap: 6px; }
.aiv-cat-group-header:first-child { margin-top: 0; }
.aiv-cat-platform-badge { font-size: 8px; background: rgba(255,255,255,0.06); border-radius: 3px; padding: 1px 5px; text-transform: none; letter-spacing: 0; opacity: 1; color: var(--muted); }
.aiv-query-row { display: flex; gap: 10px; align-items: flex-start; }
.aiv-query-icon { font-size: 12px; font-weight: 700; padding-top: 1px; flex-shrink: 0; }
.aiv-yes { color: #34d399; }
.aiv-no  { color: #ff4455; }
.aiv-query-body { flex: 1; min-width: 0; }
.aiv-query-text { font-size: 11px; color: var(--text); margin-bottom: 3px; }
.aiv-query-toggle { cursor: pointer; display: flex; align-items: baseline; gap: 4px; }
.aiv-query-toggle:hover { color: var(--accent); }
.aiv-toggle-icon { font-size: 9px; color: var(--muted); flex-shrink: 0; }
.aiv-excerpt-full { font-size: 11px; color: var(--muted); line-height: 1.6; margin: 4px 0 3px; padding: 8px 10px; background: rgba(255,255,255,0.03); border-left: 2px solid var(--border); border-radius: 0 4px 4px 0; word-break: break-word; white-space: normal; }
.aiv-sentiment { font-family: 'Space Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; border-radius: 3px; padding: 1px 5px; }
.aiv-sentiment-positive      { background: rgba(52,211,153,0.12); color: #34d399; }
.aiv-sentiment-neutral       { background: rgba(136,146,164,0.12); color: #8892a4; }
.aiv-sentiment-negative      { background: rgba(255,68,85,0.12); color: #ff4455; }
.aiv-sentiment-not-detected  { background: rgba(255,68,85,0.08); color: #ff4455; }
.aiv-spark-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; border-top: 1px solid var(--border); padding-top: 10px; }
.aiv-spark { width: 100px; height: 28px; flex-shrink: 0; }
.aiv-spark-label { font-family: 'Space Mono', monospace; font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.aiv-empty { font-size: 12px; color: var(--muted); line-height: 1.6; }
.aiv-error { font-size: 11px; color: var(--fail); margin-top: 8px; }

.stat-chip-diff { color: #b07bff; border-color: #b07bff; background: rgba(176,123,255,0.08); }
.stat-chip-diff:hover { background: rgba(176,123,255,0.16); }

.table-label { font-family: 'Space Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 10px; }

/* filter-bar, filter-search, filter-group, filter-chip, filter-count → global in assets/main.css */
.reports-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.reports-table thead tr { border-bottom: 1px solid var(--border); }
.reports-table th { text-align: left; font-family: 'Space Mono', monospace; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); padding: 0 12px 12px; overflow: hidden; }
.reports-table th:first-child { padding-left: 0; }
.reports-table th:last-child { padding-right: 0; }
.reports-table th:nth-child(1) { width: 40px; }   /* checkbox */
.reports-table th:nth-child(2) { width: 72px; }   /* type */
.reports-table th:nth-child(3) { width: 26%; }    /* url — large but bounded */
.reports-table th:nth-child(4) { width: 54px; }   /* grade */
.reports-table th:nth-child(5) { width: 54px; }   /* score */
.reports-table th:nth-child(6) { width: 100px; }  /* date */
.reports-table th:nth-child(7) { width: 54px; }   /* view */
.reports-table th:nth-child(8) { width: 40px; }   /* pdf */
.reports-table th:nth-child(9) { width: 60px; }   /* share */
.reports-table th:nth-child(10) { width: 110px; } /* delete */
.reports-table tbody tr { border-bottom: 1px solid var(--border); border-left: 2px solid transparent; transition: background 0.1s, border-left-color 0.15s; }
.reports-table tbody tr:hover { background: var(--bg2); border-left-color: var(--accent); }
.reports-table td { padding: 14px 12px; vertical-align: middle; line-height: 1; overflow: hidden; }
.reports-table td > span, .reports-table td > a, .reports-table td > button, .reports-table td > div { vertical-align: middle; }
.reports-table td:first-child { padding-left: 0; }
.reports-table td:last-child { padding-right: 0; }

.type-badge { font-family: 'Space Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; white-space: nowrap; }
.report-url { font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note-preview { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.8; }
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
.sort-th { cursor: pointer; user-select: none; white-space: nowrap; }
.sort-th:hover { color: var(--text); }
.sort-arrow { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); margin-left: 3px; }

/* Pagination bar */
.pagination-bar { display: flex; align-items: center; gap: 3px; margin-bottom: 12px; flex-wrap: wrap; }
.pg-arrow { font-family: 'Space Mono', monospace; font-size: 13px; color: var(--muted); background: none; border: 1px solid var(--border); border-radius: 4px; padding: 4px 10px; cursor: pointer; transition: color 0.15s, border-color 0.15s; line-height: 1; }
.pg-arrow:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
.pg-arrow:disabled { opacity: 0.25; cursor: not-allowed; }
.pg-num { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--muted); background: none; border: 1px solid var(--border); border-radius: 4px; padding: 4px 8px; cursor: pointer; min-width: 30px; text-align: center; transition: color 0.15s, border-color 0.15s, background 0.15s; line-height: 1; }
.pg-num:hover { color: var(--text); border-color: var(--dim2); }
.pg-num.active { color: var(--accent); border-color: var(--accent); background: rgba(77,159,255,0.12); font-weight: 700; }
.pg-ellipsis { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--muted); padding: 0 5px; opacity: 0.5; }
.pg-input { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 4px 6px; width: 72px; outline: none; text-align: center; transition: border-color 0.15s; margin-left: 8px; }
.pg-input:focus { border-color: var(--accent); }
.pg-input.error { border-color: var(--fail); animation: shake 0.3s; }
.pg-info { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); margin-left: 8px; white-space: nowrap; }
@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }

/* Restore expand-btn for trends / AIV show-more */
.expand-btn { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.04em; color: var(--muted); background: none; border: none; padding: 10px 0; cursor: pointer; display: block; }
.expand-btn:hover { color: var(--accent); }
.report-date { font-family: 'Space Mono', monospace; font-size: 12px; color: var(--muted); white-space: nowrap; }

.empty-state { text-align: center; padding: 80px 24px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg2); }
.empty-icon { margin-bottom: 16px; color: var(--muted); opacity: 0.5; }
.empty-title { font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
.empty-body { font-size: 13px; color: var(--muted); margin-bottom: 24px; }
.btn-new-audit { font-family: 'Space Mono', monospace; font-size: 12px; color: var(--accent); background: none; border: 1px solid var(--accent); border-radius: 4px; padding: 8px 16px; cursor: pointer; text-decoration: none; }
.btn-new-audit:hover { background: var(--accent); color: #fff; }

/* Batch select */
.chk-col { width: 40px; padding-left: 10px !important; padding-right: 4px !important; }
.row-check { cursor: pointer; accent-color: var(--accent); }
.bulk-action-bar { display: flex; align-items: center; gap: 10px; background: rgba(77,159,255,0.08); border: 1px solid rgba(77,159,255,0.25); border-radius: 4px; padding: 8px 14px; margin-bottom: 10px; flex-wrap: wrap; }
.bulk-sel-count { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--accent); }
.bulk-act-btn { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--text); background: var(--bg2); border: 1px solid var(--border); border-radius: 3px; padding: 4px 10px; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
.bulk-act-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.bulk-act-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.bulk-act-delete { color: var(--fail) !important; border-color: rgba(255,68,85,0.3) !important; }
.bulk-act-delete:hover:not(:disabled) { border-color: var(--fail) !important; }
.bulk-act-clear { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); background: none; border: none; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; padding: 0; }
.bulk-act-clear:hover { color: var(--text); }

/* Tags */
.tag-row { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.tag-chip { font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.04em; background: rgba(77,159,255,0.1); border: 1px solid rgba(77,159,255,0.25); border-radius: 3px; color: var(--accent); padding: 2px 5px; display: inline-flex; align-items: center; gap: 4px; }
.tag-remove { background: none; border: none; color: var(--muted); cursor: pointer; padding: 0; font-size: 8px; line-height: 1; }
.tag-remove:hover { color: var(--fail); }
.tag-add-row { margin-top: 3px; }
.tag-add-btn { font-family: 'Space Mono', monospace; font-size: 9px; color: var(--muted); background: none; border: 1px dashed var(--border); border-radius: 3px; padding: 2px 6px; cursor: pointer; transition: color 0.15s, border-color 0.15s; }
.tag-add-btn:hover { color: var(--accent); border-color: var(--accent); }
.tag-input { font-family: 'Space Mono', monospace; font-size: 10px; background: var(--bg); border: 1px solid var(--accent); border-radius: 3px; color: var(--text); padding: 2px 6px; outline: none; width: 100px; }
</style>
