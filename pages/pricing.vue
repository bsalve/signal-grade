<script setup>

const { loggedIn, user } = useUserSession()
const plan = computed(() => user.value?.plan || 'free')

const stripeAvailable = ref(false)
const hasBilling = ref(false)

onMounted(async () => {
  if (!loggedIn.value) return
  try {
    const d = await $fetch('/api/account-data')
    stripeAvailable.value = d.stripeAvailable ?? false
    hasBilling.value = d.hasBilling ?? false
  } catch {}
})

const pillarsExpanded = ref([false, false, false, false])
function togglePillar(i) {
  const arr = [...pillarsExpanded.value]
  arr[i] = !arr[i]
  pillarsExpanded.value = arr
}

const pillars = [
  {
    label: 'Technical', color: '#8892a4',
    sub: 'Site Health & Infrastructure',
    preview: [
      'HTTPS, SSL & security headers',
      'Page speed & Core Web Vitals',
      'Crawlability, robots.txt & sitemap',
      'Schema markup & structured data',
      'Mobile viewport & accessibility',
      'Caching, compression & HTTP/2',
    ],
    full: [
      'HTTPS & SSL certificate', 'Performance score', 'Mobile performance',
      'Core Web Vitals (LCP, FID, CLS)', 'robots.txt crawlability', 'Sitemap.xml presence',
      'Canonical tag', 'Meta robots directives', 'Internal link count',
      'LocalBusiness schema', 'Business hours schema', 'Aggregate rating schema',
      'Geo coordinates schema', 'Hreflang tags', 'Broken links',
      'Security headers (HSTS, X-Frame-Options, etc.)', 'Compression (gzip / Brotli)',
      'Response time (TTFB)', 'Redirect chain depth', 'Mixed content (HTTP on HTTPS)',
      'Favicon', 'Image dimensions (CLS risk)', 'Breadcrumb schema',
      'Mobile viewport tag', 'Indexability', 'Schema type inventory',
      'Schema field validation', 'Lazy loading', 'HTTP version (HTTP/2 / HTTP/3)',
      'Robots.txt safety rules', 'Canonical chain depth', 'Sitemap URL validity',
      'Accessibility (lang, landmarks, inputs)', 'Pagination tags (rel next/prev)',
      'Cache-Control header', 'Content Security Policy',
      'Resource hints (preconnect / dns-prefetch)', 'Render-blocking resources',
      'Asset minification', 'Web app manifest', 'Crawl delay directive',
      'X-Robots-Tag header', 'Cookie consent notice', 'DNS TTL',
      'JavaScript bundle size', 'Third-party script count', 'URL structure',
      'AMP page validation',
    ],
  },
  {
    label: 'Content', color: '#e8a87c',
    sub: 'Marketing & On-Page Signals',
    preview: [
      'Title tags & meta descriptions',
      'Open Graph & social preview',
      'Image alt text & optimization',
      'Readability & word count',
      'Keyword density & freshness',
      'CTAs, outbound links & brand',
    ],
    full: [
      'Title tag length & quality', 'Meta description length & quality',
      'Combined meta tag audit', 'NAP (name, address, phone)',
      'Open Graph (title, description, image, URL)', 'Twitter Card tag',
      'Image alt text coverage', 'Word count', 'Heading hierarchy (H1/H2/H3 order)',
      'Brand name consistency', 'Social media links', 'Readability (Flesch-Kincaid)',
      'Content freshness (publish / update date)', 'Outbound & authority links',
      'Call to action elements', 'Image format optimization (WebP / AVIF)',
      'OG image reachability', 'Keyword density analysis',
      'Content-to-code ratio', 'E-E-A-T content signals', 'Content tone analysis',
      'Spelling & grammar check',
    ],
  },
  {
    label: 'AEO', color: '#7baeff',
    sub: 'Answer Engine Optimization',
    preview: [
      'FAQ, HowTo & Article schema',
      'Question-form headings',
      'Featured snippet formatting',
      'Speakable markup',
      'Definition & concise answer blocks',
      'Video schema & rich results',
    ],
    full: [
      'FAQPage / QAPage schema', 'Question-form headings (H2/H3 ending in ?)',
      'Speakable schema markup', 'VideoObject schema',
      'HowTo schema with steps', 'Featured snippet paragraph length',
      'Article / BlogPosting schema', 'Definition content (dl/dt/dd, dfn)',
      'Concise answer block density', 'Answer-first content structure',
      'Comparison content blocks', 'Q&A content density', 'Table-format content',
    ],
  },
  {
    label: 'GEO', color: '#b07bff',
    sub: 'Generative Engine Optimization',
    preview: [
      'llms.txt & AI crawler access',
      'E-E-A-T signals & author schema',
      'Entity clarity & knowledge graph',
      'AI search presence (Perplexity)',
      'Citations, reviews & trust signals',
      'Semantic HTML & fact density',
    ],
    full: [
      'E-E-A-T signals (author, date, about, contact)', 'Entity clarity (org/business schema)',
      'Structured content (tables, ordered lists, headings)', 'Privacy policy & trust signals',
      'Google Business Profile link', 'Citation signals (cite, blockquote, references)',
      'Service / Product schema', 'Author schema (Person JSON-LD)',
      'Review & testimonial content', 'Service area content',
      'Multi-modal content (video / audio)', 'llms.txt presence & quality',
      'AI crawler access (GPTBot, ClaudeBot, PerplexityBot, etc.)',
      'AI search presence (Perplexity citation check)', 'Fact density signals',
      'Knowledge graph signals', 'sameAs authority links',
      'Semantic HTML structure', 'Brand disambiguation signals',
      'AI citation signals',
    ],
  },
]

const totalChecks = pillars.reduce((s, p) => s + p.full.length, 0)

useHead({
  title: 'Pricing — SignalGrade',
  meta: [
    { name: 'description', content: 'SignalGrade plans start free. Upgrade for deeper site crawls, more audits per hour, and agency branding.' },
    { property: 'og:title', content: 'Pricing — SignalGrade' },
    { property: 'og:description', content: `Free, Pro ($29/mo), and Agency ($79/mo). ${totalChecks} SEO + AEO + GEO audit checks on every plan.` },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://signalgrade.com/pricing' },
    { name: 'twitter:card', content: 'summary' },
  ],
  script: [{
    type: 'application/ld+json',
    children: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'SignalGrade',
      url: 'https://signalgrade.com',
      applicationCategory: 'BusinessApplication',
      description: `Search visibility audit tool covering Technical SEO, Content quality, AEO, and GEO signals across ${totalChecks} checks.`,
      offers: [
        { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
        { '@type': 'Offer', name: 'Pro', price: '29', priceCurrency: 'USD', billingIncrement: 'P1M' },
        { '@type': 'Offer', name: 'Agency', price: '79', priceCurrency: 'USD', billingIncrement: 'P1M' },
      ],
    }),
  }],
})
</script>

<template>
  <div>
    <AppNav>
      <AppNavAuth />
    </AppNav>

    <div class="page">
      <div class="page-hero">
        <div class="page-eyebrow">Plans &amp; Pricing</div>
        <div class="page-title">Simple, transparent pricing</div>
        <div class="page-sub">Audit any site. Export to PDF. Know your score.<br>Start free — upgrade when you need more.</div>
      </div>

      <div class="pricing-grid">

        <!-- Free -->
        <div class="pricing-card">
          <div class="tier-name">Free</div>
          <div class="tier-price">$0 <span>/ month</span></div>
          <div class="tier-desc">Get started with no commitment.</div>
          <ul class="tier-features">
            <li>10 pages per site crawl</li>
            <li>3 URLs per compare audit</li>
            <li>10 audits per hour</li>
            <li>Report history</li>
            <li>PDF exports</li>
          </ul>
          <div class="tier-cta">
            <span v-if="loggedIn && plan === 'free'" class="current-badge">Current plan</span>
            <a v-else-if="!loggedIn" href="/auth/google" class="btn-tier btn-tier-ghost">Get started free</a>
          </div>
        </div>

        <!-- Pro (featured) -->
        <div class="pricing-card featured">
          <div class="tier-popular">Most popular</div>
          <div class="tier-name">Pro</div>
          <div class="tier-price">$29 <span>/ month</span></div>
          <div class="tier-desc">For consultants and in-house SEO teams.</div>
          <ul class="tier-features">
            <li>50 pages per site crawl</li>
            <li>10 URLs per compare audit</li>
            <li>60 audits per hour</li>
            <li>Report history</li>
            <li>PDF exports</li>
            <li>Agency branding on PDFs</li>
          </ul>
          <div class="tier-cta">
            <span v-if="loggedIn && plan === 'pro'" class="current-badge">Current plan</span>
            <template v-else-if="loggedIn && plan !== 'agency' && stripeAvailable">
              <form action="/checkout" method="POST">
                <input type="hidden" name="plan" value="pro" />
                <button type="submit" class="btn-tier btn-tier-primary">Upgrade to Pro</button>
              </form>
            </template>
            <a v-else-if="!loggedIn" href="/auth/google" class="btn-tier btn-tier-primary">Get started</a>
          </div>
        </div>

        <!-- Agency -->
        <div class="pricing-card">
          <div class="tier-name">Agency</div>
          <div class="tier-price">$79 <span>/ month</span></div>
          <div class="tier-desc">For agencies running audits at scale.</div>
          <ul class="tier-features">
            <li>200 pages per site crawl</li>
            <li>10 URLs per compare audit</li>
            <li>200 audits per hour</li>
            <li>Everything in Pro</li>
            <li>Priority support</li>
          </ul>
          <div class="tier-cta">
            <span v-if="loggedIn && plan === 'agency'" class="current-badge">Current plan</span>
            <template v-else-if="loggedIn && stripeAvailable">
              <form action="/checkout" method="POST">
                <input type="hidden" name="plan" value="agency" />
                <button type="submit" class="btn-tier btn-tier-ghost">Upgrade to Agency</button>
              </form>
            </template>
            <a v-else-if="!loggedIn" href="/auth/google" class="btn-tier btn-tier-ghost">Get started</a>
          </div>
        </div>

      </div>

      <!-- Feature comparison strip -->
      <div class="compare">
        <div class="compare-title">What's included in every plan</div>
        <div class="compare-grid">
          <div class="compare-item">
            <div class="compare-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div class="compare-label">{{ totalChecks }} audit checks</div>
              <div class="compare-sub">Technical, Content, AEO, and GEO signals</div>
            </div>
          </div>
          <div class="compare-item">
            <div class="compare-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div class="compare-label">Dark-themed PDF reports</div>
              <div class="compare-sub">A4 export with grade, category scores, and recommendations</div>
            </div>
          </div>
          <div class="compare-item">
            <div class="compare-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div class="compare-label">Report history</div>
              <div class="compare-sub">Every audit saved automatically to your dashboard</div>
            </div>
          </div>
          <div class="compare-item">
            <div class="compare-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div class="compare-label">Multi-location compare</div>
              <div class="compare-sub">Side-by-side audit of multiple URLs</div>
            </div>
          </div>
          <div class="compare-item">
            <div class="compare-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div class="compare-label">Site-wide crawl</div>
              <div class="compare-sub">BFS crawler with orphan and duplicate detection</div>
            </div>
          </div>
          <div class="compare-item">
            <div class="compare-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div class="compare-label">Google sign-in</div>
              <div class="compare-sub">One-click auth — no separate password to manage</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Four pillars -->
      <div class="pillars-section">
        <div class="pillars-title">What gets audited</div>
        <div class="pillars-grid">
          <div v-for="(p, i) in pillars" :key="p.label" class="pillar-card">
            <div class="pillar-label" :style="{ color: p.color }">{{ p.label }}</div>
            <div class="pillar-sub">{{ p.sub }}</div>
            <ul class="pillar-list">
              <li v-for="item in (pillarsExpanded[i] ? p.full : p.preview)" :key="item">{{ item }}</li>
            </ul>
            <button class="pillar-toggle" @click="togglePillar(i)">
              {{ pillarsExpanded[i] ? '↑ Show less' : `+ ${p.full.length} checks` }}
            </button>
          </div>
        </div>
      </div>

      <!-- FAQ -->
      <div class="faq">
        <div class="faq-title">Common questions</div>
        <div class="faq-grid">
          <div class="faq-item">
            <div class="faq-q">What is AEO / GEO?</div>
            <div class="faq-a">AEO (Answer Engine Optimization) targets featured snippets, voice search, and question-form results. GEO (Generative Engine Optimization) covers visibility in ChatGPT, Perplexity, Gemini, and other AI-generated responses. SignalGrade audits both — alongside traditional technical and content signals.</div>
          </div>
          <div class="faq-item">
            <div class="faq-q">What does the score mean?</div>
            <div class="faq-a">Each of the {{ totalChecks }} checks is scored 0–100. Your overall grade is the arithmetic mean. A = 90+, B = 80–89, C = 70–79, D = 60–69, F = below 60. The PDF report includes a prioritized action plan.</div>
          </div>
          <div class="faq-item">
            <div class="faq-q">Does it work on JavaScript-heavy sites (SPAs)?</div>
            <div class="faq-a">Standard audits fetch static HTML. Pro and Agency users can enable JS Rendering in the Customize panel, which uses a headless browser to evaluate fully rendered pages.</div>
          </div>
          <div class="faq-item">
            <div class="faq-q">Is my data stored?</div>
            <div class="faq-a">Audit results are saved to your report history when signed in. SignalGrade does not use tracking cookies or share your data with third parties. See the <a href="/privacy" class="faq-link">Privacy Policy</a> for full details.</div>
          </div>
          <div class="faq-item">
            <div class="faq-q">Can I cancel anytime?</div>
            <div class="faq-a">Yes. Cancel from your account page at any time. Your plan stays active until the end of the current billing period — no prorated charges.</div>
          </div>
          <div class="faq-item">
            <div class="faq-q">Is there a free trial?</div>
            <div class="faq-a">The Free tier is permanent and requires no credit card. Start auditing immediately and upgrade only when you need higher limits.</div>
          </div>
          <div class="faq-item">
            <div class="faq-q">What happens when I hit the rate limit?</div>
            <div class="faq-a">Audit requests return an error message until your hourly window resets. Upgrade your plan for a higher limit, or wait for the window to reset.</div>
          </div>
          <div class="faq-item">
            <div class="faq-q">Do you offer refunds?</div>
            <div class="faq-a">Contact us within 7 days of payment and we'll issue a full refund, no questions asked.</div>
          </div>
        </div>
      </div>
    </div>

    <AppFooter />
  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scrollbar-gutter: stable; }
:root {
  --bg: #0b0c0e; --bg2: #111214; --border: #1e2025; --dim2: #2a2d35;
  --text: #e4e6ea; --muted: #8892a4; --accent: #4d9fff;
  --warn: #ffb800; --fail: #ff4455; --pass: #34d399;
}
body {
  background: var(--bg); color: var(--text);
  font-family: 'Inter', sans-serif; font-size: 14px;
  line-height: 1.5; min-height: 100vh;
}
</style>

<style scoped>

.page { max-width: 960px; margin: 0 auto; padding: 64px 32px 100px; }

.page-hero { text-align: center; margin-bottom: 56px; }
.page-eyebrow { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); margin-bottom: 12px; }
.page-title { font-size: 32px; font-weight: 700; color: var(--text); margin-bottom: 12px; letter-spacing: -0.02em; }
.page-sub { font-size: 15px; color: var(--muted); line-height: 1.7; }

/* Pricing cards */
.pricing-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 64px; }
@media (max-width: 700px) { .pricing-grid { grid-template-columns: 1fr; } }

.pricing-card {
  background: var(--bg2); border: 1px solid var(--border); border-radius: 10px;
  padding: 28px 24px; display: flex; flex-direction: column;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
  position: relative;
}
.pricing-card:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(0,0,0,0.4); }
.pricing-card.featured { border-color: var(--accent); box-shadow: 0 0 0 1px rgba(77,159,255,0.15); }
.pricing-card.featured:hover { border-color: #76baff; }

.tier-popular {
  position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
  font-family: 'Space Mono', monospace; font-size: 9px; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  background: var(--accent); color: #000; padding: 3px 12px; border-radius: 3px;
  white-space: nowrap;
}

.tier-name { font-family: 'Space Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
.pricing-card.featured .tier-name { color: var(--accent); }

.tier-price { font-family: 'Space Mono', monospace; font-size: 28px; font-weight: 700; color: var(--text); margin-bottom: 4px; line-height: 1.1; }
.tier-price span { font-size: 12px; font-weight: 400; color: var(--muted); vertical-align: middle; }

.tier-desc { font-size: 12px; color: var(--muted); margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }

.tier-features { list-style: none; margin-bottom: 24px; flex: 1; }
.tier-features li { font-size: 13px; color: var(--muted); padding: 5px 0; display: flex; align-items: center; gap: 8px; }
.tier-features li::before { content: '✓'; color: var(--pass); font-size: 11px; font-weight: 700; flex-shrink: 0; }

.tier-cta { margin-top: auto; }
.current-badge {
  display: block; text-align: center;
  font-family: 'Space Mono', monospace; font-size: 11px; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--muted); border: 1px solid var(--border);
  border-radius: 4px; padding: 10px 0;
}

.btn-tier { display: block; width: 100%; text-align: center; text-decoration: none; font-family: 'Space Mono', monospace; font-size: 12px; border-radius: 4px; padding: 10px 0; cursor: pointer; border: none; transition: background 0.15s, color 0.15s, transform 0.1s; }
.btn-tier:active { transform: scale(0.98); }
.btn-tier-primary { background: var(--accent); color: #000; }
.btn-tier-primary:hover { background: #76baff; }
.btn-tier-ghost { background: none; color: var(--muted); border: 1px solid var(--border); }
.btn-tier-ghost:hover { color: var(--text); border-color: var(--dim2); }

/* Included features strip */
.compare { margin-bottom: 64px; }
.compare-title { font-size: 13px; font-weight: 600; letter-spacing: 0.05em; color: var(--muted); text-transform: uppercase; margin-bottom: 20px; }
.compare-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
@media (max-width: 700px) { .compare-grid { grid-template-columns: 1fr; } }
.compare-item { display: flex; align-items: flex-start; gap: 12px; }
.compare-icon { color: var(--pass); flex-shrink: 0; margin-top: 2px; }
.compare-label { font-size: 13px; font-weight: 500; color: var(--text); }
.compare-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }

/* Four pillars */
.pillars-section { border-top: 1px solid var(--border); padding-top: 48px; margin-bottom: 64px; }
.pillars-title { font-size: 13px; font-weight: 600; letter-spacing: 0.05em; color: var(--muted); text-transform: uppercase; margin-bottom: 20px; }
.pillars-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; }
@media (max-width: 800px) { .pillars-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 480px) { .pillars-grid { grid-template-columns: 1fr; } }
.pillar-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
.pillar-label { font-family: 'Space Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
.pillar-sub { font-size: 11px; color: var(--muted); margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
.pillar-list { list-style: none; }
.pillar-list li { font-size: 12px; color: var(--muted); padding: 4px 0; padding-left: 14px; position: relative; line-height: 1.45; }
.pillar-list li::before { content: '·'; position: absolute; left: 0; color: var(--border); }
.pillar-toggle { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.05em; color: var(--accent); background: none; border: none; cursor: pointer; padding: 10px 0 0; display: block; }
.pillar-toggle:hover { text-decoration: underline; }

/* FAQ */
.faq { border-top: 1px solid var(--border); padding-top: 48px; }
.faq-title { font-size: 13px; font-weight: 600; letter-spacing: 0.05em; color: var(--muted); text-transform: uppercase; margin-bottom: 24px; }
.faq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px 48px; }
@media (max-width: 600px) { .faq-grid { grid-template-columns: 1fr; } }
.faq-q { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
.faq-a { font-size: 13px; color: var(--muted); line-height: 1.65; }
.faq-a a { color: var(--accent); text-decoration: none; }
.faq-a a:hover { text-decoration: underline; }
</style>
