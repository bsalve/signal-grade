<script setup>
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const reportId = route.params.id

useHead({ title: 'Report — SearchGrade' })

const error = ref(null)

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
    }
  }

  if (report.audit_type === 'site') {
    // results_json shape: {name, status, normalizedScore, failCount, warnCount, passCount, totalPages}[]
    // Convert back to the {name, fail:[], warn:[], pass:[]} shape renderSiteResults expects
    const pageCount = results[0]?.totalPages || 1
    const siteResults = results.map(r => ({
      name: r.name,
      // Reconstruct synthetic URL arrays from counts — no actual URLs stored, but counts are
      fail: Array.from({ length: r.failCount || 0 }, (_, i) => `page ${i + 1}`),
      warn: Array.from({ length: r.warnCount || 0 }, (_, i) => `page ${i + 1}`),
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
      ...meta,
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
  max-width: 1080px;
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
/* Override results section display since it's always visible here */
#results { display: block !important; opacity: 1 !important; }
</style>

<template>
  <div>
    <AppNav>
      <AppNavAuth />
    </AppNav>

    <div class="report-replay-wrap">
      <a href="/dashboard" class="report-replay-back">← Back to Dashboard</a>

      <div v-if="error" class="report-replay-error">{{ error }}</div>

      <!-- app-main.js renders into #resultsInner via _sgReplayData -->
      <section id="results" style="display:block">
        <div id="resultsInner">
          <div v-if="!error" style="text-align:center;padding:60px 32px;color:var(--muted);font-size:13px">Loading report…</div>
        </div>
      </section>
    </div>

    <AppFooter />
  </div>
</template>
