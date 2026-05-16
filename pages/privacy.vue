<script setup>
useHead({
  title: 'Privacy Policy — SearchGrade',
  meta: [
    { property: 'og:title', content: 'Privacy Policy — SearchGrade' },
    { property: 'og:image', content: 'https://searchgrade.com/og-image.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: 'https://searchgrade.com/og-image.png' },
  ],
})
</script>

<template>
  <div>
    <AppNav>
      <a href="/" class="nav-link">← Home</a>
    </AppNav>

    <div class="legal-page">
      <div class="page-title">Privacy Policy</div>
      <div class="page-date">Effective: January 1, 2025 &nbsp;·&nbsp; Last updated: April 23, 2026</div>

      <p>SearchGrade ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains what information we collect, how we use it, and your choices regarding that information.</p>

      <h2>1. Information We Collect</h2>

      <p><strong>Account information</strong> — When you sign in with Google, we receive your name, email address, and profile picture from Google. We store this to identify your account and personalize your experience.</p>
      <p><strong>Audit data</strong> — We store URLs you audit, your audit results (score, grade, PDF filename), and the date of each audit. This powers your report history in the Dashboard.</p>
      <p><strong>Usage data</strong> — We may collect standard server logs including IP addresses, browser type, and page requests. This information is used for security, abuse prevention, and service improvement.</p>
      <p><strong>Payment information</strong> — If you subscribe to a paid plan, your payment is processed by Stripe. We do not store your credit card number or billing details — Stripe handles this securely on our behalf. We receive and store your Stripe customer ID and subscription status.</p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To provide, operate, and improve the Service</li>
        <li>To save your audit history and generate PDF reports</li>
        <li>To process payments and manage your subscription</li>
        <li>To send transactional emails (e.g., scheduled audit reports, billing receipts) — only when you have opted in to a feature that requires email delivery</li>
        <li>To detect and prevent abuse, fraud, and security incidents</li>
        <li>To comply with legal obligations</li>
      </ul>
      <p>We do not sell your personal information to third parties.</p>

      <h2>3. Cookies and Sessions</h2>
      <p>We use a session cookie to keep you signed in across page visits. This cookie is stored in your browser and expires after 30 days of inactivity or when you sign out. We do not use tracking cookies, advertising cookies, or third-party analytics cookies.</p>

      <h2>4. Third-Party Services</h2>
      <p>We use the following third-party services that may receive limited data:</p>
      <ul>
        <li><strong>Google OAuth</strong> — for sign-in authentication. Governed by Google's Privacy Policy.</li>
        <li><strong>Stripe</strong> — for payment processing. Governed by Stripe's Privacy Policy.</li>
        <li><strong>Google PageSpeed Insights API</strong> — when auditing a URL, we send that URL to the PSI API to retrieve performance metrics. No personal information is transmitted.</li>
        <li><strong>Google Fonts</strong> — fonts are loaded from Google's CDN. Google may log the request.</li>
      </ul>

      <h2>5. Data Retention</h2>
      <p>We retain your account information and audit history for as long as your account is active. You may delete individual audit reports from your Dashboard at any time. To delete your account entirely, contact us at <a href="mailto:support@searchgrade.com">support@searchgrade.com</a> and we will permanently delete your account and associated data within 30 days.</p>

      <h2>6. Data Security</h2>
      <p>We use industry-standard measures to protect your data, including encrypted database connections (TLS), session tokens stored securely, and server-side input validation. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>

      <h2>7. Children's Privacy</h2>
      <p>The Service is not directed to children under 13. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a child, contact us immediately.</p>

      <h2>8. Your Rights</h2>
      <p>Depending on your location, you may have the right to:</p>
      <ul>
        <li>Access the personal information we hold about you</li>
        <li>Request correction of inaccurate information</li>
        <li>Request deletion of your personal information</li>
        <li>Object to or restrict our processing of your data</li>
        <li>Data portability (receive your data in a machine-readable format)</li>
      </ul>
      <p>To exercise any of these rights, email us at <a href="mailto:support@searchgrade.com">support@searchgrade.com</a>.</p>

      <h2>9. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of material changes by updating the "Last updated" date above. Continued use of the Service after changes constitutes acceptance of the revised policy.</p>

      <h2>10. Contact</h2>
      <p>For privacy-related questions or requests, contact us at <a href="mailto:support@searchgrade.com">support@searchgrade.com</a>.</p>
    </div>
  </div>
</template>

<style scoped>
.legal-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 56px 32px 80px;
  font-size: 15px;
  line-height: 1.7;
}

.page-title { font-size: 28px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
.page-date {
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.06em;
  margin-bottom: 48px;
}

h2 { font-size: 16px; font-weight: 600; color: var(--text); margin-top: 40px; margin-bottom: 12px; }
p { color: var(--muted); margin-bottom: 16px; }
strong { color: var(--text); }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
ul { color: var(--muted); padding-left: 20px; margin-bottom: 16px; }
ul li { margin-bottom: 6px; }

.nav-link { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); text-decoration: none; letter-spacing: 0.05em; padding: 5px 10px; border-radius: 4px; transition: background 0.15s, color 0.15s; }
.nav-link:hover { background: rgba(228,230,234,0.06); color: var(--text); }
</style>
