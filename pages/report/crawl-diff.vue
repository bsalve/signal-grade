<script setup>
definePageMeta({ middleware: 'auth' })

const route = useRoute()
useHead({ title: 'Crawl Comparison — SearchGrade' })

const diffData = ref(null)
const error    = ref(null)

const improved  = computed(() => diffData.value?.diff.filter(d => d.change === 'improved')  ?? [])
const regressed = computed(() => diffData.value?.diff.filter(d => d.change === 'regressed') ?? [])
const unchanged = computed(() => diffData.value?.diff.filter(d => d.change === 'unchanged') ?? [])

const showUnchanged = ref(false)

const { stripPrefix } = useCheckName()

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusLabel(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
}

function statusColor(s) {
  if (s === 'pass') return '#34d399'
  if (s === 'warn') return '#ffb800'
  if (s === 'fail') return '#ff4455'
  return '#8892a4'
}

function scoreColor(score) {
  if (score >= 90) return '#34d399'
  if (score >= 80) return '#4d9fff'
  if (score >= 70) return '#ffb800'
  if (score >= 60) return '#ff8800'
  return '#ff4455'
}

onMounted(async () => {
  const { a, b } = route.query
  if (!a || !b) { error.value = 'Missing report IDs.'; return }
  try {
    diffData.value = await $fetch(`/api/reports/crawl-diff?a=${a}&b=${b}`)
  } catch (e) {
    error.value = e.data?.message || 'Failed to load crawl comparison.'
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
          <div class="page-title">Crawl Comparison</div>
          <div class="page-subtitle">What changed between two site audits</div>
        </div>
        <a href="/dashboard" class="back-link">← Back to Dashboard</a>
      </div>

      <div v-if="error" class="diff-error">{{ error }}</div>

      <template v-else-if="diffData">
        <!-- Audit headers -->
        <div class="audit-header-row">
          <div class="audit-header-card audit-a">
            <div class="audit-header-label">Audit A (earlier)</div>
            <div class="audit-header-url">{{ diffData.reportA.url }}</div>
            <div class="audit-header-meta">
              <span class="audit-score" :style="`color:${scoreColor(diffData.reportA.score)}`">
                {{ diffData.reportA.grade }} · {{ diffData.reportA.score }}/100
              </span>
              <span class="audit-date">{{ fmtDate(diffData.reportA.createdAt) }}</span>
            </div>
          </div>
          <div class="audit-arrow">→</div>
          <div class="audit-header-card audit-b">
            <div class="audit-header-label">Audit B (latest)</div>
            <div class="audit-header-url">{{ diffData.reportB.url }}</div>
            <div class="audit-header-meta">
              <span class="audit-score" :style="`color:${scoreColor(diffData.reportB.score)}`">
                {{ diffData.reportB.grade }} · {{ diffData.reportB.score }}/100
              </span>
              <span class="audit-date">{{ fmtDate(diffData.reportB.createdAt) }}</span>
            </div>
          </div>
        </div>

        <!-- Summary stats -->
        <div class="diff-stats">
          <div class="diff-stat diff-stat-reg">
            <span class="diff-stat-n">{{ regressed.length }}</span>
            <span class="diff-stat-l">Regressed</span>
          </div>
          <div class="diff-stat diff-stat-imp">
            <span class="diff-stat-n">{{ improved.length }}</span>
            <span class="diff-stat-l">Improved</span>
          </div>
          <div class="diff-stat diff-stat-unch">
            <span class="diff-stat-n">{{ unchanged.length }}</span>
            <span class="diff-stat-l">Unchanged</span>
          </div>
        </div>

        <!-- Regressed -->
        <template v-if="regressed.length > 0">
          <div class="diff-section-label diff-label-reg">Regressed</div>
          <div class="diff-table">
            <div class="diff-row diff-head">
              <div>Check</div>
              <div>Before</div>
              <div>After</div>
              <div>Score</div>
            </div>
            <div v-for="d in regressed" :key="d.name" class="diff-row diff-row-reg">
              <div class="diff-check-name">{{ stripPrefix(d.name) }}</div>
              <div>
                <span class="diff-status" :style="`color:${statusColor(d.statusA)}`">{{ statusLabel(d.statusA) }}</span>
              </div>
              <div>
                <span class="diff-status" :style="`color:${statusColor(d.statusB)}`">{{ statusLabel(d.statusB) }}</span>
              </div>
              <div class="diff-score-cell">
                <span v-if="d.scoreA !== null && d.scoreB !== null" class="diff-score-delta diff-score-down">
                  {{ d.scoreA }} → {{ d.scoreB }}
                </span>
                <span v-else class="diff-score-na">—</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Improved -->
        <template v-if="improved.length > 0">
          <div class="diff-section-label diff-label-imp">Improved</div>
          <div class="diff-table">
            <div class="diff-row diff-head">
              <div>Check</div>
              <div>Before</div>
              <div>After</div>
              <div>Score</div>
            </div>
            <div v-for="d in improved" :key="d.name" class="diff-row diff-row-imp">
              <div class="diff-check-name">{{ stripPrefix(d.name) }}</div>
              <div>
                <span class="diff-status" :style="`color:${statusColor(d.statusA)}`">{{ statusLabel(d.statusA) }}</span>
              </div>
              <div>
                <span class="diff-status" :style="`color:${statusColor(d.statusB)}`">{{ statusLabel(d.statusB) }}</span>
              </div>
              <div class="diff-score-cell">
                <span v-if="d.scoreA !== null && d.scoreB !== null" class="diff-score-delta diff-score-up">
                  {{ d.scoreA }} → {{ d.scoreB }}
                </span>
                <span v-else class="diff-score-na">—</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Unchanged (collapsed) -->
        <template v-if="unchanged.length > 0">
          <button class="diff-unchanged-toggle" @click="showUnchanged = !showUnchanged">
            {{ showUnchanged ? '▾' : '▸' }} Unchanged ({{ unchanged.length }} checks)
          </button>
          <template v-if="showUnchanged">
            <div class="diff-table diff-table-muted">
              <div class="diff-row diff-head">
                <div>Check</div>
                <div>Status</div>
                <div></div>
                <div>Score</div>
              </div>
              <div v-for="d in unchanged" :key="d.name" class="diff-row diff-row-unch">
                <div class="diff-check-name">{{ stripPrefix(d.name) }}</div>
                <div>
                  <span class="diff-status" :style="`color:${statusColor(d.statusB)}`">{{ statusLabel(d.statusB) }}</span>
                </div>
                <div></div>
                <div class="diff-score-cell">
                  <span v-if="d.scoreB !== null" class="diff-score-na">{{ d.scoreB }}</span>
                  <span v-else class="diff-score-na">—</span>
                </div>
              </div>
            </div>
          </template>
        </template>
      </template>

      <div v-else class="diff-loading">Loading comparison…</div>
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

.page { max-width: 1080px; margin: 0 auto; padding: 40px 32px 80px; }
.page-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 28px; }
.page-title { font-size: 22px; font-weight: 600; }
.page-subtitle { font-size: 13px; color: var(--muted); margin-top: 4px; }
.back-link { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--accent); text-decoration: none; }
.back-link:hover { text-decoration: underline; }

.diff-error { color: var(--fail); font-size: 14px; padding: 24px; border: 1px solid var(--fail); background: rgba(255,68,85,0.06); }
.diff-loading { color: var(--muted); font-size: 13px; padding: 40px 0; text-align: center; }

.audit-header-row { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.audit-header-card { flex: 1; background: var(--bg2); border: 1px solid var(--border); padding: 16px 20px; min-width: 0; }
.audit-header-label { font-family: 'Space Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 6px; }
.audit-header-url { font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 8px; }
.audit-header-meta { display: flex; align-items: center; gap: 12px; }
.audit-score { font-family: 'Space Mono', monospace; font-size: 13px; font-weight: 700; }
.audit-date { font-size: 12px; color: var(--muted); }
.audit-arrow { font-size: 20px; color: var(--muted); flex-shrink: 0; }

.diff-stats { display: flex; gap: 16px; margin-bottom: 28px; }
.diff-stat { flex: 1; background: var(--bg2); border: 1px solid var(--border); padding: 14px 16px; display: flex; align-items: baseline; gap: 8px; }
.diff-stat-n { font-family: 'Space Mono', monospace; font-size: 20px; font-weight: 700; }
.diff-stat-l { font-size: 12px; color: var(--muted); }
.diff-stat-reg .diff-stat-n { color: var(--fail); }
.diff-stat-imp .diff-stat-n { color: var(--pass); }
.diff-stat-unch .diff-stat-n { color: var(--muted); }

.diff-section-label { font-family: 'Space Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; padding: 6px 0; margin-bottom: 8px; margin-top: 24px; border-bottom: 1px solid var(--border); }
.diff-label-reg { color: var(--fail); }
.diff-label-imp { color: var(--pass); }

.diff-table { border: 1px solid var(--border); margin-bottom: 8px; }
.diff-row { display: grid; grid-template-columns: 1fr 90px 90px 100px; gap: 0; border-bottom: 1px solid var(--border); }
.diff-row:last-child { border-bottom: none; }
.diff-head { background: var(--bg2); }
.diff-head > div { font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); padding: 8px 12px; }
.diff-row > div { padding: 10px 12px; font-size: 13px; display: flex; align-items: center; }
.diff-row-reg { border-left: 3px solid var(--fail); }
.diff-row-imp { border-left: 3px solid var(--pass); }
.diff-row-unch { border-left: 3px solid var(--border); }
.diff-check-name { color: var(--text); }
.diff-status { font-family: 'Space Mono', monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.diff-score-cell { font-family: 'Space Mono', monospace; font-size: 11px; }
.diff-score-delta { font-weight: 600; }
.diff-score-up   { color: var(--pass); }
.diff-score-down { color: var(--fail); }
.diff-score-na   { color: var(--muted); }

.diff-table-muted .diff-row-unch { opacity: 0.7; }
.diff-unchanged-toggle { font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 0.04em; color: var(--muted); background: none; border: 1px solid var(--border); padding: 6px 14px; cursor: pointer; margin-top: 24px; margin-bottom: 8px; transition: color 0.15s, border-color 0.15s; }
.diff-unchanged-toggle:hover { color: var(--text); border-color: var(--dim2); }
</style>
