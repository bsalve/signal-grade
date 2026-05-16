<script setup>
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const reportId = route.params.id

useHead({ title: 'Report — SearchGrade' })

const error = ref(null)

// Notes state
const notes      = ref('')
const notesDraft = ref('')
const notesSaving = ref(false)
const notesSaved  = ref(false)
const notesError  = ref(false)

async function saveNotes() {
  notesSaving.value = true
  notesSaved.value  = false
  notesError.value  = false
  try {
    await $fetch(`/api/reports/${reportId}/notes`, { method: 'PATCH', body: { notes: notesDraft.value } })
    notes.value      = notesDraft.value
    notesSaved.value = true
    setTimeout(() => { notesSaved.value = false }, 2500)
  } catch {
    notesError.value = true
    setTimeout(() => { notesError.value = false }, 3000)
  }
  notesSaving.value = false
}

// Build the data object renderResults / renderSiteResults expects, then hand it to app-main.js
function buildReplayData(report) {
  const results = report.results_json
  if (!results || !results.length) return null

  if (report.audit_type === 'page') {
    // results_json shape: {name, status, normalizedScore, message, details, recommendation}[]
    return {
      _replayType: 'page',
      id: report.id,
      url: report.url,
      auditedAt: report.created_at,
      totalScore: report.score,
      grade: report.grade,
      pdfFile: report.pdf_filename,
      results,
      ai_summary: report.ai_summary ?? null,
      ai_recs_json: report.ai_recs_json ?? null,
      fixes: report.fixes ?? {},
    }
  }

  if (report.audit_type === 'site') {
    // results_json shape: {name, status, normalizedScore, failCount, warnCount, passCount, totalPages, failUrls?, warnUrls?}[]
    // Convert back to the {name, fail:[], warn:[], pass:[]} shape renderSiteResults expects
    const pageCount = results[0]?.totalPages || 1
    const siteResults = results.map(r => ({
      name: r.name,
      // Use stored URL arrays when present (new reports); fall back to synthetic labels for old reports
      fail: r.failUrls?.length ? r.failUrls : Array.from({ length: r.failCount || 0 }, (_, i) => `page ${i + 1}`),
      warn: r.warnUrls?.length ? r.warnUrls : Array.from({ length: r.warnCount || 0 }, (_, i) => `page ${i + 1}`),
      pass: Array.from({ length: r.passCount || 0 }, (_, i) => `page ${i + 1}`),
      recommendation: r.recommendation,
      message: r.message,
    }))
    // Spread any saved architecture data (meta_json) — depthDistribution, dirCounts, linkEquity,
    // plus any future fields — so new features automatically appear in replayed reports
    const meta = report.meta_json || {}
    return {
      _replayType: 'site',
      url: report.url,
      auditedAt: report.created_at,
      pageCount,
      results: siteResults,
      pdfFile: report.pdf_filename,
      siteScore: report.score,
      siteGrade: report.grade,
      ...meta,
    }
  }

  if (report.audit_type === 'multi') {
    const meta = report.meta_json || {}
    if (!meta.locations?.length) return null
    const insight = report.ai_recs_json?.__comparison_insight__ ?? null
    return {
      _replayType: 'multi',
      locations: meta.locations,
      pdfFile: report.pdf_filename,
      comparisonInsight: insight,
    }
  }

  return null
}

onMounted(async () => {
  try {
    // Pre-fetch plan so AI Fix buttons render correctly during replay
    const me = await $fetch('/api/me').catch(() => null)
    if (me?.user) window._sgPlan = me.user.plan || 'free'

    const report = await $fetch(`/api/reports/${reportId}`)

    // Update page title with URL
    useHead({ title: `Report: ${report.url} — SearchGrade` })

    // Load notes
    notes.value = report.notes || ''
    notesDraft.value = report.notes || ''

    const replayData = buildReplayData(report)
    if (!replayData) {
      error.value = 'This report has no saved result data.'
      return
    }

    window._sgReplayData = replayData

    if (typeof window._sgOnMount === 'function') {
      window._sgOnMount()
    } else {
      const s = document.createElement('script')
      s.src = '/app-main.js'
      document.body.appendChild(s)
    }
  } catch (e) {
    error.value = e.data?.message || 'Could not load report.'
  }
})
</script>

<style>
.report-replay-wrap {
  max-width: min(1400px, calc(100vw - 64px));
  margin: 0 auto;
  padding: 32px 32px 64px;
}
.report-replay-back {
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  text-decoration: none;
  letter-spacing: 0.05em;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 28px;
}
.report-replay-back:hover { color: var(--text); }
.report-replay-error {
  text-align: center;
  padding: 80px 32px;
  color: var(--muted);
  font-size: 14px;
}
/* Override results section — strip double padding/max-width since .report-replay-wrap handles the container */
.report-replay-wrap #results { display: block !important; opacity: 1 !important; padding: 0 0 40px !important; max-width: none !important; }

/* Notes panel */
.notes-panel {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 16px 20px;
  margin-bottom: 24px;
}
.notes-label {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin-bottom: 10px;
}
.notes-input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  line-height: 1.6;
  padding: 10px 12px;
  outline: none;
  resize: vertical;
  min-height: 80px;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.notes-input:focus { border-color: var(--accent); }
.notes-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.notes-count {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: var(--muted);
}
.notes-save {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: var(--accent);
  background: none;
  border: 1px solid var(--accent);
  border-radius: 3px;
  padding: 4px 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.notes-save:hover:not(:disabled) { background: rgba(77,159,255,0.1); }
.notes-save:disabled { opacity: 0.4; cursor: not-allowed; }
.notes-status { font-family: 'Space Mono', monospace; font-size: 10px; flex: 1; padding-left: 10px; }
.notes-status--saving { color: var(--muted); }
.notes-status--saved  { color: var(--pass); }
.notes-status--error  { color: var(--fail); }
</style>

<template>
  <div>
    <AppNav>
      <AppNavAuth />
    </AppNav>

    <div class="report-replay-wrap">
      <a href="/dashboard" class="report-replay-back">← Back to Dashboard</a>

      <div v-if="error" class="report-replay-error">{{ error }}</div>

      <!-- Notes panel (shown once report loads, i.e. no error) -->
      <div v-if="!error" class="notes-panel">
        <div class="notes-label">Notes</div>
        <textarea
          v-model="notesDraft"
          class="notes-input"
          placeholder="Add internal notes about this report…"
          maxlength="10000"
        />
        <div class="notes-footer">
          <span class="notes-count">{{ notesDraft.length }}/10000</span>
          <span v-if="notesSaving" class="notes-status notes-status--saving">Saving…</span>
          <span v-else-if="notesSaved" class="notes-status notes-status--saved">Saved.</span>
          <span v-else-if="notesError" class="notes-status notes-status--error">Save failed.</span>
          <button
            class="notes-save"
            :disabled="notesSaving || notesDraft === notes"
            @click="saveNotes"
          >Save</button>
        </div>
      </div>

      <!-- app-main.js renders into #resultsInner via _sgReplayData -->
      <section id="results" style="display:block">
        <div id="resultsInner">
          <div v-if="!error" style="text-align:center;padding:60px 32px;color:var(--muted);font-size:13px">Loading report…</div>
        </div>
      </section>
    </div>
  </div>
</template>
