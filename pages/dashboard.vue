<script setup>
definePageMeta({ middleware: 'auth' })
useHead({ title: 'Dashboard — SignalGrade' })

const dashData = ref(null)

const user = computed(() => dashData.value?.user ?? null)
const reports = computed(() => dashData.value?.reports ?? [])
const reportCount = computed(() => dashData.value?.reportCount ?? 0)
const hasReports = computed(() => dashData.value?.hasReports ?? false)

async function confirmDelete(reportId, tr, td) {
  td.innerHTML = '<span class="del-status">Deleting…</span>'
  try {
    const res = await $fetch(`/api/reports/${reportId}`, { method: 'DELETE' })
    if (res.ok) {
      tr.remove()
      if (document.querySelectorAll('.reports-table tbody tr').length === 0) {
        location.reload()
      }
    } else {
      td.innerHTML = '<span class="del-error">Error</span>'
    }
  } catch {
    td.innerHTML = '<span class="del-error">Error</span>'
  }
}

function startDelete(event) {
  const btn = event.currentTarget
  const td = btn.closest('td')
  const tr = btn.closest('tr')
  const reportId = tr.dataset.reportId

  td.innerHTML = `
    <span class="del-confirm">Sure?
      <button class="btn-del-yes" data-id="${reportId}">Yes</button>
      <button class="btn-del-no">No</button>
    </span>`

  td.querySelector('.btn-del-yes').addEventListener('click', () => confirmDelete(reportId, tr, td))
  td.querySelector('.btn-del-no').addEventListener('click', () => {
    td.innerHTML = '<button class="btn-delete">Delete</button>'
    td.querySelector('.btn-delete').addEventListener('click', startDelete)
  })
}

onMounted(async () => {
  try {
    dashData.value = await $fetch('/api/dashboard-data')
  } catch {
    // auth middleware will redirect if unauthenticated
  }
  await nextTick()
  document.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', startDelete))
})
</script>

<template>
  <div>
    <AppNav>
      <AppNavAuth>
        <a href="/pricing" class="nav-link">Pricing</a>
        <a href="/dashboard" class="nav-link nav-link-current">Dashboard</a>
        <a href="/account" class="nav-link">Account</a>
      </AppNavAuth>
    </AppNav>

    <div class="page">
      <div class="page-header">
        <div>
          <div class="page-title">Report History</div>
          <div class="page-subtitle">Your saved audits from SignalGrade</div>
        </div>
      </div>

      <template v-if="hasReports">
        <div class="stats-row">
          <div class="stat-chip">
            <strong>{{ reportCount }}</strong> report{{ reportCount !== 1 ? 's' : '' }} saved
          </div>
        </div>

        <table class="reports-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>URL</th>
              <th>Grade</th>
              <th>Score</th>
              <th>Date</th>
              <th>PDF</th>
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
              </td>
              <td>
                <span class="report-grade" :style="`color:${report.gradeColor};`">{{ report.grade }}</span>
              </td>
              <td>
                <span class="report-score">{{ report.score != null ? `${report.score}/100` : '—' }}</span>
              </td>
              <td>
                <span class="report-date">{{ report.dateFormatted }}</span>
              </td>
              <td>
                <a v-if="report.pdf_filename" :href="`/output/${report.pdf_filename}`" class="pdf-link" download>↓ PDF</a>
                <span v-else class="no-pdf">—</span>
              </td>
              <td class="del-cell">
                <button class="btn-delete" @click="startDelete">Delete</button>
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
</style>

<style scoped>
.nav-link { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); text-decoration: none; letter-spacing: 0.05em; padding: 5px 10px; border-radius: 4px; transition: background 0.15s, color 0.15s; }
.nav-link:hover { background: rgba(228,230,234,0.06); color: var(--text); }
.nav-link-current { color: var(--accent); background: rgba(77,159,255,0.08); pointer-events: none; }

.page { max-width: 1080px; margin: 0 auto; padding: 40px 32px 80px; }
.page-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 32px; }
.page-title { font-size: 22px; font-weight: 600; color: var(--text); }
.page-subtitle { font-size: 13px; color: var(--muted); margin-top: 4px; }

.stats-row { display: flex; gap: 24px; margin-bottom: 28px; }
.stat-chip { font-family: 'Space Mono', monospace; font-size: 12px; letter-spacing: 0.04em; color: var(--muted); background: var(--bg2); border: 1px solid var(--border); border-radius: 4px; padding: 6px 14px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.04); }
.stat-chip strong { color: var(--text); font-weight: 700; }

.reports-table { width: 100%; border-collapse: collapse; }
.reports-table thead tr { border-bottom: 1px solid var(--border); }
.reports-table th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); padding: 0 12px 12px; }
.reports-table th:first-child { padding-left: 0; }
.reports-table th:last-child { padding-right: 0; }
.reports-table tbody tr { border-bottom: 1px solid var(--border); border-left: 2px solid transparent; transition: background 0.1s, border-left-color 0.15s; }
.reports-table tbody tr:hover { background: var(--bg2); border-left-color: var(--accent); }
.reports-table td { padding: 14px 12px; vertical-align: middle; }
.reports-table td:first-child { padding-left: 0; }
.reports-table td:last-child { padding-right: 0; }

.type-badge { font-family: 'Space Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; white-space: nowrap; }
.report-url { font-size: 13px; color: var(--text); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.report-grade { font-family: 'Space Mono', monospace; font-size: 18px; font-weight: 700; line-height: 1; }
.report-score { font-family: 'Space Mono', monospace; font-size: 13px; color: var(--muted); }
.report-date { font-size: 12px; color: var(--muted); white-space: nowrap; }
.pdf-link { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--accent); text-decoration: none; border: 1px solid var(--border); border-radius: 4px; padding: 4px 10px; white-space: nowrap; transition: border-color 0.15s, background 0.15s; }
.pdf-link:hover { border-color: var(--accent); background: rgba(77,159,255,0.07); }
.no-pdf { font-size: 12px; color: var(--dim2); }

.btn-delete { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); background: none; border: 1px solid var(--border); border-radius: 4px; padding: 4px 10px; cursor: pointer; letter-spacing: 0.04em; transition: color 0.15s, border-color 0.15s; }
.btn-delete:hover { color: var(--fail); border-color: var(--fail); }
.del-confirm { display: flex; align-items: center; gap: 6px; font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); white-space: nowrap; }
.btn-del-yes { font-family: 'Space Mono', monospace; font-size: 10px; color: #fff; background: var(--fail); border: none; border-radius: 4px; padding: 4px 10px; cursor: pointer; }
.btn-del-no { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); background: none; border: 1px solid var(--border); border-radius: 4px; padding: 4px 10px; cursor: pointer; }
.btn-del-no:hover { color: var(--text); }
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
