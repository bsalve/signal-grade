<script setup lang="ts">
const error = useError()

const statusCode = computed(() => error.value?.statusCode ?? 500)
const message = computed(() => {
  if (statusCode.value === 404) return 'Page not found'
  return 'Something went wrong'
})
const sub = computed(() => {
  if (statusCode.value === 404) return "The page you're looking for doesn't exist or has been moved."
  return 'An unexpected error occurred. Please try again or return home.'
})

useHead({ title: 'Error — SearchGrade' })
</script>

<style scoped>

.error-wrap {
  min-height: calc(100vh - 57px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 32px;
}
.error-card {
  text-align: center;
  max-width: 480px;
}
.error-code {
  font-family: 'Space Mono', monospace;
  font-size: 72px;
  font-weight: 700;
  color: var(--muted);
  line-height: 1;
  margin-bottom: 24px;
  letter-spacing: -2px;
}
.error-msg {
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 12px;
}
.error-sub {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 32px;
}
.error-btn {
  display: inline-block;
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 10px 24px;
  background: var(--accent);
  color: #fff;
  text-decoration: none;
  transition: background 0.15s;
}
.error-btn:hover { background: #76baff; }
</style>

<template>
  <AppNav>
    <AppNavAuth />
  </AppNav>
  <div class="error-wrap">
    <div class="error-card">
      <div class="error-code">{{ statusCode }}</div>
      <div class="error-msg">{{ message }}</div>
      <div class="error-sub">{{ sub }}</div>
      <a href="/" class="error-btn" @click.prevent="clearError({ redirect: '/' })">Go home →</a>
    </div>
  </div>
  <AppFooter />
</template>
