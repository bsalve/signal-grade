<script setup>
defineProps({
  links: {
    type: Array,
    default: () => [],
  },
})
</script>

<template>
  <nav class="navbar">
    <div class="navbar-inner">
      <a href="/" class="nav-brand">SEARCH<span>GRADE</span></a>
      <div class="nav-links">
        <slot />
        <template v-for="link in links" :key="link.href">
          <a :href="link.href" :class="['nav-link', link.active ? 'active' : '', link.muted ? 'muted' : '']">
            {{ link.label }}
          </a>
        </template>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  border-bottom: 1px solid var(--border);
  background: rgba(11, 12, 14, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 10;
}
.navbar-inner {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 32px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.nav-brand {
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.15em;
  text-decoration: none;
  text-transform: uppercase;
  background: linear-gradient(90deg, var(--muted), var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
.nav-links { display: flex; align-items: center; gap: 16px; }
.nav-link {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: var(--muted);
  text-decoration: none;
  letter-spacing: 0.05em;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}
.nav-link:hover { background: rgba(228,230,234,0.06); color: var(--text); }
.nav-link.active { color: var(--accent); background: rgba(77,159,255,0.08); }
</style>
