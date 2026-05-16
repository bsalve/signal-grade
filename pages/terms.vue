<script setup>
useHead({
  title: 'Terms of Service — SearchGrade',
  meta: [
    { property: 'og:title', content: 'Terms of Service — SearchGrade' },
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
      <div class="page-title">Terms of Service</div>
      <div class="page-date">Effective: January 1, 2025 &nbsp;·&nbsp; Last updated: April 23, 2026</div>

      <p>Please read these Terms of Service ("Terms") carefully before using SearchGrade ("the Service"), operated by SearchGrade ("we," "us," or "our"). By accessing or using the Service, you agree to be bound by these Terms.</p>

      <h2>1. Acceptance of Terms</h2>
      <p>By creating an account or using the Service in any way, you confirm that you are at least 18 years of age, have read and understood these Terms, and agree to comply with them. If you do not agree, do not use the Service.</p>

      <h2>2. Description of Service</h2>
      <p>SearchGrade is a search visibility audit tool that analyzes publicly accessible web pages for technical, content, AEO (Answer Engine Optimization), and GEO (Generative Engine Optimization) signals. The Service generates audit reports, grades, and recommendations based on this analysis.</p>

      <h2>3. Acceptable Use</h2>
      <p>You agree to use the Service only to audit websites you own, operate, or have authorization to audit. You must not:</p>
      <ul>
        <li>Use the Service to audit websites without the website owner's permission</li>
        <li>Attempt to circumvent rate limits or usage restrictions</li>
        <li>Use automated scripts to abuse the Service beyond your plan's allotted usage</li>
        <li>Reverse-engineer, copy, or redistribute the Service or its outputs for commercial purposes without our consent</li>
        <li>Use the Service in any way that violates applicable laws or regulations</li>
      </ul>

      <h2>4. User Accounts</h2>
      <p>When you create an account using Google OAuth, you are responsible for maintaining the security of your account. You are responsible for all activity that occurs under your account. Notify us immediately at <a href="mailto:support@searchgrade.com">support@searchgrade.com</a> if you suspect unauthorized access.</p>

      <h2>5. Subscription Plans and Billing</h2>
      <p>Certain features of the Service require a paid subscription. By subscribing, you authorize us to charge your payment method on a recurring basis according to your selected plan. Subscriptions automatically renew unless canceled at least 24 hours before the renewal date.</p>
      <p>All fees are non-refundable except where required by law or at our sole discretion. We reserve the right to change pricing with 30 days' notice. Continued use of the Service after a price change constitutes acceptance of the new pricing.</p>

      <h2>6. Cancellation</h2>
      <p>You may cancel your subscription at any time through the Account page. Upon cancellation, you will retain access to paid features through the end of your current billing period. After that, your account will revert to the Free tier.</p>

      <h2>7. Audit Data and Reports</h2>
      <p>Audit results are based on publicly available information at the time of the audit. Results reflect a snapshot in time and may not represent the current state of the audited website. SearchGrade makes no warranty that audit results are complete, error-free, or suitable for any specific purpose.</p>
      <p>We may store your audit history in order to provide the report history feature. You may delete your reports at any time from the Dashboard.</p>

      <h2>8. Intellectual Property</h2>
      <p>The Service, including its design, code, and methodologies, is owned by SearchGrade and protected by intellectual property laws. You retain ownership of the websites you audit. Audit reports generated for your own websites may be used freely for your business purposes.</p>

      <h2>9. Disclaimer of Warranties</h2>
      <p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT AUDIT RESULTS WILL REFLECT ACTUAL SEARCH ENGINE PERFORMANCE. SEARCH ENGINE ALGORITHMS CHANGE FREQUENTLY AND RESULTS MAY VARY.</p>

      <h2>10. Limitation of Liability</h2>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, SEARCHGRADE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.</p>

      <h2>11. Modifications to the Service</h2>
      <p>We reserve the right to modify, suspend, or discontinue the Service at any time with or without notice. We are not liable to you or any third party for any modification, suspension, or discontinuation of the Service.</p>

      <h2>12. Changes to Terms</h2>
      <p>We may update these Terms at any time. We will notify you of material changes by updating the "Last updated" date above. Continued use of the Service after changes constitutes acceptance of the revised Terms.</p>

      <h2>13. Governing Law</h2>
      <p>These Terms are governed by the laws of the United States. Any disputes arising from these Terms or the Service shall be resolved in the appropriate courts of the United States.</p>

      <h2>14. Contact</h2>
      <p>For questions about these Terms, contact us at <a href="mailto:support@searchgrade.com">support@searchgrade.com</a>.</p>
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
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
ul { color: var(--muted); padding-left: 20px; margin-bottom: 16px; }
ul li { margin-bottom: 6px; }

.nav-link { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); text-decoration: none; letter-spacing: 0.05em; padding: 5px 10px; border-radius: 4px; transition: background 0.15s, color 0.15s; }
.nav-link:hover { background: rgba(228,230,234,0.06); color: var(--text); }
</style>
