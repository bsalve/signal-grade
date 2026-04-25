<script setup>
const { loggedIn, user } = useUserSession()
</script>

<template>
  <template v-if="loggedIn">
    <img v-if="user?.avatar_url" :src="user.avatar_url" alt="" class="auth-avatar" referrerpolicy="no-referrer" />
    <slot />
    <span class="nav-divider"></span>
    <a href="/auth/logout" class="nav-signout">Sign out</a>
  </template>
  <template v-else>
    <a href="/pricing" class="nav-pricing">Pricing</a>
    <a href="/auth/google" class="nav-signin">Sign in</a>
  </template>
</template>

<style scoped>
.auth-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid var(--border);
}
.nav-divider {
  display: inline-block;
  width: 1px;
  height: 14px;
  background: var(--border);
  user-select: none;
  vertical-align: middle;
}
.nav-signout {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: var(--muted);
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 10px;
  text-decoration: none;
  letter-spacing: 0.05em;
  transition: color 0.15s, border-color 0.15s;
}
.nav-signout:hover { color: var(--fail); border-color: var(--fail); }
.nav-pricing {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: var(--muted);
  text-decoration: none;
  letter-spacing: 0.05em;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}
.nav-pricing:hover { background: rgba(228,230,234,0.06); color: var(--text); }
.nav-signin {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: var(--muted);
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 5px 12px;
  text-decoration: none;
  letter-spacing: 0.05em;
  transition: color 0.15s, border-color 0.15s;
}
.nav-signin:hover { color: var(--text); border-color: var(--dim2); box-shadow: 0 0 8px rgba(77,159,255,0.25); }
</style>
