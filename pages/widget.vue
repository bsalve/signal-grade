<script setup lang="ts">
// No auth required — widget validates via API key passed in ?key= query
useHead({ title: 'SignalGrade Widget' })

const route  = useRoute()
const apiKey = computed(() => route.query.key as string || '')

const url      = ref('')
const loading  = ref(false)
const error    = ref('')
const result   = ref<{ score: number; grade: string; results: any[] } | null>(null)

function gradeColor(score: number) {
  if (score >= 90) return '#34d399'
  if (score >= 80) return '#4d9fff'
  if (score >= 70) return '#ffb800'
  if (score >= 60) return '#ff8800'
  return '#ff4455'
}

async function runAudit() {
  if (!url.value.trim()) return
  loading.value = true
  error.value   = ''
  result.value  = null
  try {
    result.value = await $fetch('/widget-audit', {
      method:  'POST',
      body:    { url: url.value.trim(), apiKey: apiKey.value },
    })
  } catch (e: any) {
    error.value = e.data?.message || 'Audit failed. Check your API key and URL.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="wgt-wrap">
    <div class="wgt-brand">SIGNALGRADE</div>

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
      <div class="wgt-grade-block">
        <span class="wgt-grade" :style="`color:${gradeColor(result.score)}`">{{ result.grade }}</span>
        <span class="wgt-score">{{ result.score }}/100</span>
      </div>

      <div class="wgt-issues">
        <div class="wgt-issues-label">Top Issues</div>
        <div
          v-for="r in result.results.filter(r => r.status === 'fail').slice(0, 5)"
          :key="r.name"
          class="wgt-issue-row"
        >
          <span class="wgt-dot wgt-dot-fail"></span>
          <span class="wgt-issue-name">{{ r.name.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, '') }}</span>
        </div>
        <div v-if="!result.results.filter(r => r.status === 'fail').length" class="wgt-no-issues">
          No failing checks.
        </div>
      </div>

      <a href="https://signalgrade.com" target="_blank" class="wgt-footer">
        Powered by SignalGrade
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
