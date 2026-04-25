/**
 * Thin wrapper around the /audit and /crawl endpoints.
 * The heavy lifting (DOM manipulation, rendering) is still handled by
 * app-main.js on the index page. This composable is available for future
 * Vue SFC pages that need audit functionality without the legacy script.
 */
export function useAudit() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const result = ref<any>(null)

  async function runPageAudit(url: string, logoUrl?: string) {
    loading.value = true
    error.value = null
    result.value = null
    try {
      const data = await $fetch('/audit', {
        method: 'POST',
        body: { url, logoUrl },
      })
      result.value = data
    } catch (err: any) {
      error.value = err.data?.message ?? err.message ?? 'Audit failed'
    } finally {
      loading.value = false
    }
  }

  async function runMultiAudit(locations: Array<{ url: string; label?: string }>) {
    loading.value = true
    error.value = null
    result.value = null
    try {
      const data = await $fetch('/multi-audit', {
        method: 'POST',
        body: { locations },
      })
      result.value = data
    } catch (err: any) {
      error.value = err.data?.message ?? err.message ?? 'Audit failed'
    } finally {
      loading.value = false
    }
  }

  return { loading, error, result, runPageAudit, runMultiAudit }
}
