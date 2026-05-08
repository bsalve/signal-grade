<script setup lang="ts">
// No auth required — widget validates via API key passed in ?key= query
useHead({ title: 'SearchGrade Widget' })

const route  = useRoute()
const apiKey = computed(() => route.query.key as string || '')

const url      = ref('')
const loading  = ref(false)
const error    = ref('')
const result   = ref<{ score: number; grade: string; results: any[]; leadCaptureEnabled: boolean } | null>(null)

// Lead capture state
const leadEmail       = ref('')
const leadSubmitting  = ref(false)
const leadError       = ref('')
const leadSubmitted   = ref(false)
const showFullResults = ref(false)

const { gradeColor } = useGradeColor()

async function runAudit() {
  if (!url.value.trim()) return
  loading.value      = true
  error.value        = ''
  result.value       = null
  leadSubmitted.value  = false
  showFullResults.value = false
  leadEmail.value    = ''
  leadError.value    = ''
  try {
    result.value = await $fetch('/widget-audit', {
      method:  'POST',
      body:    { url: url.value.trim(), apiKey: apiKey.value },
    })
    // If lead capture is off, show full results immediately
    if (!result.value?.leadCaptureEnabled) {
      showFullResults.value = true
    }
  } catch (e: any) {
    error.value = e.data?.message || 'Audit failed. Check your API key and URL.'
  } finally {
    loading.value = false
  }
}

async function submitLead() {
  leadError.value = ''
  if (!leadEmail.value.trim()) {
    leadError.value = 'Please enter your email.'
    return
  }
  leadSubmitting.value = true
  try {
    await $fetch('/api/widget-leads', {
      method: 'POST',
      body: {
        email:  leadEmail.value.trim(),
        url:    url.value.trim(),
        score:  result.value?.score,
        grade:  result.value?.grade,
        apiKey: apiKey.value,
      },
    })
    leadSubmitted.value   = true
    showFullResults.value = true
  } catch (e: any) {
    leadError.value = e.data?.message || 'Could not save — please try again.'
  } finally {
    leadSubmitting.value = false
  }
}
</script>

<template>
  <div class="wgt-wrap">
    <div class="wgt-brand">SEARCHGRADE</div>

    <div class="wgt-form">
      <input
        v-model="url"
        class="wgt-input"
        type="url"
        placeholder="https://yoursite.com"
        @keydown.enter="runAudit"
      />
      <button class="wgt-btn" :disabled="loading" @click="runAudit">
        {{ loading ? '…' : 'Audit →' }}
      </button>
    </div>

    <div v-if="error" class="wgt-error">{{ error }}</div>

    <div v-if="result" class="wgt-result">
      <!-- Teaser: always visible -->
      <div class="wgt-grade-block">
        <span class="wgt-grade" :style="`color:${gradeColor(result.score)}`">{{ result.grade }}</span>
        <span class="wgt-score">{{ result.score }}/100</span>
      </div>

      <!-- Lead capture gate -->
      <div v-if="result.leadCaptureEnabled && !showFullResults" class="wgt-lead-gate">
        <div class="wgt-lead-label">Enter your email to see the full report</div>
        <div class="wgt-lead-form">
          <input
            v-model="leadEmail"
            class="wgt-input"
            type="email"
            placeholder="you@example.com"
            @keydown.enter="submitLead"
          />
          <button class="wgt-btn" :disabled="leadSubmitting" @click="submitLead">
            {{ leadSubmitting ? '…' : 'See Report →' }}
          </button>
        </div>
        <div v-if="leadError" class="wgt-error">{{ leadError }}</div>
      </div>

      <!-- Full results (shown after lead capture or when lead capture is off) -->
      <template v-if="showFullResults && result.results">
        <div class="wgt-issues">
          <div class="wgt-issues-label">Top Issues</div>
          <div
            v-for="r in result.results?.filter(r => r.status === 'fail').slice(0, 5)"
            :key="r.name"
            class="wgt-issue-row"
          >
            <span class="wgt-dot wgt-dot-fail"></span>
            <span class="wgt-issue-name">{{ r.name.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, '') }}</span>
          </div>
          <div v-if="!result.results?.filter(r => r.status === 'fail').length" class="wgt-no-issues">
            No failing checks.
          </div>
        </div>
      </template>

      <a href="https://searchgrade.com" target="_blank" class="wgt-footer">
        Powered by SearchGrade
      </a>
    </div>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; margin: 0; padding: 0; }
.wgt-wrap {
  min-height: 100vh;
  background: #0b0c0e;
  color: #e4e6ea;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.wgt-brand {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.14em;
  color: #8892a4;
}
.wgt-form { display: flex; gap: 8px; }
.wgt-input {
  flex: 1;
  background: #111214;
  border: 1px solid #1e2025;
  border-radius: 4px;
  color: #e4e6ea;
  font-size: 13px;
  padding: 10px 12px;
  outline: none;
  transition: border-color 0.15s;
}
.wgt-input:focus { border-color: #4d9fff; }
.wgt-btn {
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  background: #4d9fff;
  color: #0b0c0e;
  border: none;
  border-radius: 4px;
  padding: 10px 16px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.wgt-btn:hover:not(:disabled) { background: #76baff; }
.wgt-btn:disabled { opacity: 0.5; cursor: default; }
.wgt-error { font-size: 12px; color: #ff4455; }
.wgt-result { display: flex; flex-direction: column; gap: 16px; }
.wgt-grade-block { display: flex; align-items: baseline; gap: 10px; }
.wgt-grade {
  font-family: 'Space Mono', monospace;
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
}
.wgt-score {
  font-family: 'Space Mono', monospace;
  font-size: 14px;
  color: #8892a4;
}
.wgt-lead-gate {
  background: #111214;
  border: 1px solid #1e2025;
  border-radius: 6px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wgt-lead-label {
  font-size: 12px;
  color: #e4e6ea;
  font-weight: 500;
}
.wgt-lead-form { display: flex; gap: 8px; }
.wgt-issues { display: flex; flex-direction: column; gap: 6px; }
.wgt-issues-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #8892a4; margin-bottom: 4px; }
.wgt-issue-row { display: flex; align-items: center; gap: 8px; }
.wgt-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.wgt-dot-fail { background: #ff4455; }
.wgt-issue-name { color: #e4e6ea; font-size: 12px; }
.wgt-no-issues { font-size: 12px; color: #34d399; }
.wgt-footer {
  display: block;
  font-size: 10px;
  color: #8892a4;
  text-decoration: none;
  letter-spacing: 0.04em;
  margin-top: 4px;
  border-top: 1px solid #1e2025;
  padding-top: 12px;
}
.wgt-footer:hover { color: #4d9fff; }
</style>
