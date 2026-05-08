<template>
  <footer class="app-footer">
    <div class="footer-inner">
      <a href="/terms" class="footer-link">Terms</a>
      <a href="/privacy" class="footer-link">Privacy</a>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  border-top: 1px solid var(--border);
  padding: 20px 32px;
  text-align: center;
}
.footer-inner {
  max-width: min(1400px, calc(100vw - 64px));
  margin: 0 auto;
  display: flex;
  justify-content: center;
  gap: 24px;
}
.footer-link {
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  text-decoration: none;
  letter-spacing: 0.05em;
}
.footer-link:hover { color: var(--text); }
</style>
