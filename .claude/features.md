# SearchGrade — Implemented Features

This file is the canonical record of what has been built. Update it as features are implemented.
Reference this before planning — if something is listed here, do not re-implement it.

---

## Audit Modes (Homepage)

### Page Audit
- Single URL full audit: fetches page, runs all enabled audit modules, scores, grades
- Real-time SSE progress bar: each audit check streams a `{ type:'progress', check, completed, total }` event; `auditRunner.js` runs checks sequentially and fires `onProgress` callback after each
- Score hero: grade letter (A–F), animated score counter, pass/warn/fail stats row, 4 category pillars
- SERP preview card: title + meta desc + URL snippet with char-count indicators (colored pass/warn/fail)
- Results list: color-coded rows by status (pass/warn/fail), expandable details + recommendations
- AI Executive Summary card (Pro+): auto-generated on load from Groq/Gemini; cached in `ai_summary` column
- AI Fix Recommendations (Pro+): per-check on demand, cached in `ai_recs_json`
- AI Meta Generator (Pro+): generates title + meta desc options; copy-to-clipboard
- AI Topic Coverage (Pro+): auto-generated coverage score + gap list; cached in `ai_recs_json`
- AI Content Brief (Pro+): auto-generated on load; cached in `ai_recs_json`
- Schema Template Generator: outputs ready-to-paste JSON-LD (LocalBusiness, FAQPage, Article, etc.)
- PDF export: dark-themed A4 via Handlebars + Puppeteer
- JSON export
- CSV export
- **Compare vs. Competitor button** (T1-6, Pro+): after export row, pre-fills multi-audit first URL and switches to Compare tab
- **Improvement Roadmap** (T1-5): score target selector (60/70/80/90), renders list of checks to fix to reach target; score simulation using `(100 - normalizedScore) / totalChecks` per check; auto-renders on load with pre-selected next grade target
- **Result filter bar** (T1-2): status buttons (All/Fails/Warnings/Passed) + category pills (All/Technical/Content/AEO/GEO); filters visible result rows and card strip by AND of status+category; `applyPageFilter()` function; category stored in `data-cat` attribute on cards
- JS Rendering toggle (Pro+): headless Puppeteer pre-render via `fetchPageWithJS`; adds ~15s
- Report saved to DB for logged-in users; `reportId` returned for AI caching

### Site Audit (Crawler)
- BFS crawler: same-origin, max 50/200/500 pages (Free/Pro/Agency) — T1-11 raised limits
- Real SSE progress events: `{ type:'progress', crawled, total, url }`
- Worker threads per page: 1 GB V8 heap cap, 45s timeout (`pageWorker.js`)
- Post-crawl detectors: duplicate titles/meta/body, orphan pages, click depth >3, keyword cannibalization (Jaccard >0.6), thin content (<300/500 words), slow pages (≥800/1800ms)
- Site score/grade: server-calculated and emitted in SSE `done` event (synced to DB value)
- Site results: aggregated by fail count, stacked bars per check
- Site audit saved to DB with `audit_type: 'site'`, `cat_scores_json`, `meta_json` (depth/dir/linkEquity/responseStats/aiSummary)
- `results_json` per check includes `failUrls[]` and `warnUrls[]` (capped at 50) for real URL display in saved report viewer
- PDF export (dark themed, site-specific template)
- XLSX export (SheetJS CDN)
- Sitemap XML export (client-side Blob download)

### Compare / Multi Audit
- Up to 3/10/10 URLs (Free/Pro/Agency)
- Side-by-side comparison table: per-check pass/warn/fail per URL
- Filter: All / Fails / Warns
- Delta highlighting for 2-URL compares: regression (red), improvement (green), unchanged
- AI Comparison Insight (Pro+): stored in `ai_recs_json.__comparison_insight__`
- Saved to DB as `audit_type: 'multi'`; full `locations` data in `meta_json` for replay
- PDF export (multi-report.hbs)
- CSV export

### Bulk Audit
- Up to 10/100/500 URLs (Free/Pro/Agency)
- Paste textarea input; each URL audited sequentially
- Results table: URL, grade, score, fail/warn/pass counts, top 3 issues, category score pills
- Category Averages strip at top (Technical/Content/AEO/GEO averages across batch)
- Sortable columns: URL, Grade, Score, Fails
- AI Triage Summary (Pro+): batch headline, critical URLs, common issue, quick win
- CSV export
- Each URL saved as a page report to DB (with `cat_scores_json`, `reportId` returned per row)
- Progress bar: fake STEPS driven (same pattern as page audit)

---

## Audit Check Library (100+ checks)

All checks are in `/audits/`, auto-discovered at Nitro startup. Naming prefix determines category.

### Technical (~41 checks)
- `checkSSL.js` — SSL/HTTPS presence and certificate validity
- `checkCrawlability.js` — robots.txt + meta robots crawlability check
- `checkMetaRobots.js` — meta robots directives (noindex/nofollow)
- `checkCanonical.js` — canonical tag presence and correctness
- `technicalCanonicalChain.js` — canonical chain detection (multi-hop)
- `technicalRedirectChain.js` — redirect chain length
- `technicalRobotsSafety.js` — robots.txt safety check
- `technicalSitemapValidation.js` — sitemap presence + URL validity
- `technicalBrokenLinks.js` — internal broken link detection (skipped in site crawl)
- `technicalIndexability.js` — noindex signals check
- `technicalHreflang.js` — hreflang tag presence + self-reference
- `technicalPagination.js` — rel=prev/next pagination signals
- `technicalMobileViewport.js` — viewport meta tag
- `checkPageSpeed.js` — PageSpeed Insights API: LCP, CLS, TBT, FCP, PSI score (skipped in site crawl)
- `technicalResponseTime.js` — server response time
- `technicalHTTPVersion.js` — HTTP/2 or HTTP/3 detection
- `technicalCompression.js` — gzip/brotli content encoding
- `technicalCacheControl.js` — Cache-Control header presence + max-age
- `technicalCSP.js` — Content-Security-Policy header
- `technicalSecurityHeaders.js` — X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy
- `technicalMixedContent.js` — HTTP resources on HTTPS pages
- `technicalCookieConsent.js` — cookie consent signal detection
- `technicalPreconnect.js` — `<link rel="preconnect">` / `<link rel="dns-prefetch">`
- `technicalRenderBlocking.js` — `<script>` without defer/async in `<head>`
- `technicalMinification.js` — JS/CSS asset minification (heuristic via .min. in path)
- `technicalWebManifest.js` — `<link rel="manifest">` + Content-Type validation
- `technicalCrawlDelay.js` — robots.txt Crawl-delay directive (skipped in site crawl)
- `technicalXRobotsTag.js` — X-Robots-Tag: noindex response header
- `technicalJsBundleSize.js` — JS bundle size estimation
- `technicalLazyLoading.js` — image lazy loading attribute detection
- `technicalImageDimensions.js` — width/height attributes on images
- `technicalThirdPartyScripts.js` — third-party script detection + count
- `technicalAMP.js` — AMP page detection (skipped in site crawl)
- `technicalUrlStructure.js` — URL cleanliness (length, special chars, underscores)
- `technicalDnsTtl.js` — DNS TTL check
- `technicalFavicon.js` — favicon presence
- `technicalAccessibility.js` — basic accessibility signals
- `technicalAggregateRating.js` — AggregateRating schema presence
- `technicalBreadcrumbSchema.js` — BreadcrumbList schema
- `technicalSchemaInventory.js` — inventory of all schema types on page
- `technicalSchemaValidation.js` — JSON-LD schema structural validation
- `technicalBusinessHours.js` — business hours in schema
- `technicalGeoCoordinates.js` — geo coordinate schema presence
- `schema.js` — general schema.org structured data presence

### Content (~20 checks)
- `titleTag.js` — title tag presence, length (50–60), keyword check
- `headings.js` — H1 presence, hierarchy (H1→H2→H3)
- `metaDescription.js` — meta desc presence + length (120–155)
- `checkMetaTags.js` — meta tag completeness (overlaps with titleTag/metaDesc intentionally)
- `checkImageAlt.js` — image alt text coverage
- `checkOpenGraph.js` — OG tag presence (title, desc, image, type, url)
- `contentOGImageCheck.js` — OG image URL validity + dimensions (skipped in site crawl)
- `contentWordCount.js` — word count (300 fail, 300–700 warn, 700+ pass)
- `contentReadability.js` — Flesch reading ease score
- `contentHeadingHierarchy.js` — heading nesting correctness
- `contentKeywordDensity.js` — keyword density in body
- `contentFreshness.js` — last-modified, published date signals
- `contentInternalLinks.js` — internal link count + quality
- `contentOutboundLinks.js` — external link presence
- `contentCodeRatio.js` — code-to-text ratio
- `contentSpelling.js` — spelling check (skipped in site crawl)
- `contentTone.js` — tone/formality detection
- `contentSocialLinks.js` — social media link presence
- `contentBrandConsistency.js` — brand name consistency
- `contentCallToAction.js` — CTA presence
- `contentImageOptimization.js` — image optimization signals
- `checkNAP.js` — Name/Address/Phone consistency

### AEO (~13 checks)
- `aeoFaqSchema.js` — FAQPage schema presence + quality
- `aeoHowToSchema.js` — HowTo schema
- `aeoArticleSchema.js` — Article/NewsArticle schema
- `aeoVideoSchema.js` — VideoObject schema
- `aeoSpeakable.js` — Speakable schema presence
- `aeoFeaturedSnippetFormat.js` — content formatted for featured snippets (definition, list, table, paragraph)
- `aeoQuestionHeadings.js` — question-form H2/H3 headings
- `aeoConciseAnswers.js` — short direct answers following question headings
- `aeoAnswerFirst.js` — inverted pyramid: answer before detail
- `aeoQaDensity.js` — Q&A pair density
- `aeoDefinitionContent.js` — definition-format content
- `aeoComparisonContent.js` — comparison content structures
- `aeoTableContent.js` — tabular data usage

### GEO (~20 checks)
- `geoEeat.js` — E-E-A-T signals (Experience, Expertise, Authority, Trust)
- `contentEeat.js` — Content-level E-E-A-T
- `geoEntityClarity.js` — entity disambiguation in content
- `geoBrandDisambiguation.js` — brand name disambiguation
- `geoSameAsAuthority.js` — sameAs schema links to authority sources
- `geoCitations.js` — citation and reference signals
- `geoFactDensity.js` — factual claim density
- `geoAuthorSchema.js` — Person/author schema
- `geoGoogleBusinessProfile.js` — Google Business Profile signal detection
- `geoKnowledgeGraph.js` — Knowledge Graph eligibility signals
- `geoMultiModal.js` — multi-modal content signals (image, video, audio)
- `geoPrivacyTrust.js` — privacy/trust signals (privacy policy, terms)
- `geoReviewContent.js` — review/testimonial content
- `geoServiceSchema.js` — Service schema
- `geoServiceAreaContent.js` — service area content
- `geoSemanticHtml.js` — semantic HTML5 element usage
- `geoStructuredContent.js` — structured content organization
- `geoAiCitationSignals.js` — signals that predict AI citation inclusion
- `geoAICrawlerAccess.js` — AI crawler access in robots.txt (GPTBot, ClaudeBot, PerplexityBot, etc.)
- `geoLlmsTxt.js` — /llms.txt + /llms-full.txt presence and quality
- `geoAIPresence.js` — Live AI search presence check via Perplexity API (skipped in site crawl)

---

## Dashboard (`pages/dashboard.vue`)

- **Report History Table**: type badge, URL, grade, score, date, view/PDF/share/delete buttons; sortable by date column
- **Filter/Search Bar** (T1-1): URL text search, type chips (All/Page/Site/Bulk/Compare), grade chips, date range chip; `filter-bar`/`filter-chip` global CSS classes
- **Report Tagging** (T2-1): tag column on reports; create/assign tags from dashboard; filter table by tag; tags shown as colored chips per row
- **Batch Operations** (T2-14): checkboxes on table rows; bulk action bar: "Delete selected (N)", "Add tag to selected", "Export CSV"; uses per-report delete/tag APIs in a loop
- **Expandable multi-location rows** (for compare/multi audits): shows per-URL grade + score
- **Score Trend Cards** (requires ≥2 page audits per domain):
  - Overall score strip: large score number + ↑/↓ delta + full-width SVG sparkline (blue)
  - 2×2 KPI grid: 4 category cells (Technical/Content/AEO/GEO) each with score + delta + sparkline
  - Expand → full Chart.js multi-line chart (Total + 4 categories) + CWV tab
  - CWV tab: LCP (s), CLS (×10), PSI Score history line chart
- **AI Visibility Section** (Pro+):
  - Per-domain cards with AI Visibility Score (0–100)
  - Category sub-scores: Awareness, Discovery, Recommendation
  - Inferred category detection ("SaaS", "Agency", etc.)
  - Per-query breakdown: ✓/✕ icon, query text, expandable excerpt, sentiment badge
  - Query category headers (Brand Awareness / Category Discovery / Recommendation)
  - Weekly 90-day sparkline
  - Run Scan / Rescan button
- **Stat Chips**: report count, "Compare hostname ↗", "Crawl diff ↗", "Scheduled Audits" link
- **Crawl Diff Links**: auto-detected when 2+ site audits exist for same domain
- Report soft-delete (filters from list client-side via `deleted_at`)
- Share report: generates public token, copies URL to clipboard
- AI visibility history loaded on mount for all tracked domains

---

## Saved Report Viewer (`pages/report/[id].vue`)

- Loads saved audit from DB by report ID
- Replays all audit types: page, site, multi/compare
- Page replay: passes `_sgReplayData` to `app-main.js` for full re-render
- Site replay: reconstructs synthetic fail/warn/pass arrays from stored counts (actual URLs not stored — see backlog T0-2)
- Multi/compare replay: reconstructs locations array from `meta_json.locations`
- "← Back to Dashboard" breadcrumb
- Share report generation from viewer
- **Notes Panel** (T2-2): textarea above results; saves to `reports.notes` via `PATCH /api/reports/[id]/notes`; character count (10,000 max); saved/error feedback; pre-loaded from DB on mount
- **Issue Fix Tracker** (T1-4, Pro+): per-check status dropdown (Not Started / In Progress / Done) on every failing check; persisted in `report_fixes` table via `PATCH /api/reports/[id]/fixes`; status visible on page load

---

## Compare View (`pages/compare.vue`)

- Loads two reports by `?a=ID1&b=ID2` query params
- Shows older vs. newer score with grade colors
- Per-check delta table: check name, before/after score, point change
- Regressions listed first (worst first), Improvements next
- Unchanged checks behind collapsible toggle
- Delta badges: +/- colored green/red

---

## Account Page (`pages/account.vue`)

### Billing & Plan
- Current plan badge (Free/Pro/Agency) with per-limit display
- Usage stats: reports this month + total reports saved
- Upgrade buttons (Stripe checkout integration)
- Billing portal link
- Dev Tools card (for plan switching + test email)

### Profile
- PDF Logo URL input (Agency): saves to `users.pdf_logo_url`, auto-applies to PDFs
- White-label brand color picker (Agency): hex input, saves to `users.brand_color`
- White-label toggle

### API Keys (Pro+)
- Create key with label → secret shown once
- List keys: label, created, last_used_at, copy-to-clipboard
- Delete key: two-step confirmation (first click shows inline confirm row; second click revokes permanently)

### Google Integrations (Pro+)
- Connection status card in account.vue: green dot if `google_access_token` present; "Connect / Reconnect Google" button redirects to `/auth/google`
- GSC data panel: auto-loads on page audit results and saved report viewer via `GET /api/gsc-data?url=...`; shows top 10 queries (clicks, impressions, position)
- GA4 data panel: same — `GET /api/ga4-data?url=...`; shows sessions + engagement rate by channel
- Both panels already wired in `app-main.js` (`loadGscPanel`, `loadGa4Panel`, `buildGscPanelHtml`, `buildGa4PanelHtml`); called after audit completion and from report/[id].vue replay
- OAuth scopes already configured in `nuxt.config.ts`: `webmasters.readonly` + `analytics.readonly`

### Webhooks
- Create webhook: URL input → secret shown once
- List webhooks
- Delete webhook
- Event type selection UI: **not implemented** (see backlog T2-6)

### Scheduled Audits (Pro+)
- Create: URL + frequency
- List: URL, frequency, last_run_at, enabled toggle
- Delete schedule
- Frequency options: daily, weekly, monthly; **digest** frequency (T2-8) — weekly/monthly summary email aggregating all scheduled audit results for that period
- Email + webhook notification on run
- No "run now" button (see backlog)

### Notifications (Pro+)
- Slack webhook URL input
- Microsoft Teams webhook URL input
- Save with confirmation

### Widget Lead Capture (Agency)
- Enable/disable toggle
- Lead list: email, URL, score, grade, date, key label
- CSV export

### Account Management
- Delete account: requires typing "DELETE", clears session, cascades all data

---

## Pricing Page (`pages/pricing.vue`)

- Three tiers: Free ($0), Pro ($29/mo), Agency ($79/mo)
- Per-tier feature lists
- Feature comparison strip (7 benefits)
- Four pillars breakdown with expandable check lists (Technical/Content/AEO/GEO)
- FAQ section (8 Q&A pairs)
- Stripe checkout on CTA buttons (logged-in users); sign-in redirect (logged-out)
- Current plan badge shown for existing subscribers
- **Annual billing toggle** (T1-3): monthly/annual switch shows "Save 20%" badge, dynamically updates prices (Pro: $23/mo, Agency: $63/mo when billed annually), passes `billingPeriod` to checkout; `checkout.post.ts` selects `STRIPE_PRO_ANNUAL_PRICE_ID` / `STRIPE_AGENCY_ANNUAL_PRICE_ID` env vars

---

## Share / Public Reports

- `reports/[id]/share.post.ts`: generates `share_token`, returns `/report/share/[token]` URL
- `pages/report/share/[token].vue`: public view with white-label branding (agency brand color + logo)
- No auth required to view shared reports
- Share link copied to clipboard from dashboard or report viewer

---

## Server / Infrastructure

### Auth
- Google OAuth via `nuxt-auth-utils` + `defineOAuthGoogleEventHandler`
- Sealed cookie sessions (`NUXT_SESSION_PASSWORD`)
- Middleware: `00.apiKeyAuth.ts` (Bearer token), `01.rateLimit.ts` (in-memory per-plan)
- Anonymous rate limit: 5/hr

### API
- All audit routes: `POST /audit`, `GET /crawl` (SSE), `POST /multi-audit`, `POST /bulk-audit`, `POST /widget-audit`
- All API routes: `/api/me`, `/api/dashboard-data`, `/api/account-data`, `/api/reports/*`, `/api/keys/*`, `/api/scheduled/*`, `/api/webhooks/*`, `/api/ai-*`, `/api/cwv-history`, `/api/gsc-data`, `/api/ga4-data`, `/api/share/*`, `/api/widget-leads`, `/api/account/*`
- Stripe: `POST /checkout`, `POST /billing-portal`, `POST /webhooks/stripe`

### Database (PostgreSQL via Knex)
Tables: `users`, `reports`, `api_keys`, `scheduled_audits`, `webhooks`, `sessions`, `share_tokens`, `google_tokens`, `ai_visibility_scans`, `cwv_history`, `widget_leads`, `report_fixes`
Migrations: `001`–`025` in `db/migrations/` (021: onboarding `onboarded_at` on users; 022: report_fixes; 023: report tags; 024: report notes; 025: digest_frequency on scheduled_audits)

### AI
- `utils/gemini.js` — Groq API wrapper (`callGemini`, model `llama-3.1-8b-instant` or similar, temp 0.1)
- `utils/aiVisibility.js` — 10-query scan across 3 categories with mention/sentiment detection + `inferCategory`
- All AI features gated to Pro/Agency and require `GROQ_API_KEY`

### Other Utilities
- `utils/generatePDF.js` — Handlebars + Puppeteer (reads `.hbs` fresh each call)
- `utils/crawler.js` — BFS same-origin crawler with worker threads
- `utils/r2.js` — Cloudflare R2 optional PDF storage (partially wired)
- `utils/email.js` — Resend email helper
- `utils/webhooks.js` — HMAC-SHA256 signed webhook dispatcher
- `utils/notify.js` — Notification dispatcher (email + webhook for scheduled results)
- `utils/gsc.js` — Google Search Console API helper
- `utils/ga4.js` — Google Analytics 4 API helper
- `utils/tiers.js` — Plan tier definitions + `requirePro()`
- `utils/db.js` — Knex instance (returns null without DATABASE_URL)

---

## Social Preview

- `public/og-image.png` — 1200×630 social card (dark bg, SearchGrade wordmark, tagline, grade card + pillar bars); generated via `node scripts/generate-og-image.js`
- `og:image` + `twitter:card: summary_large_image` added to all public pages: `/`, `/pricing`, `/docs`, `/terms`, `/privacy`

---

## Pages

- `/` — Homepage audit interface
- `/dashboard` — Report history + score trends + AI visibility (with filter/search bar: URL search, type/grade/date chips, T1-1)
- `/account` — Account settings, billing, API, webhooks, schedules
- `/pricing` — Public pricing page (with annual/monthly toggle, T1-3)
- `/onboarding` — 3-step onboarding wizard for new signups (T1-10): run first audit → score explanation + top 3 fails → monitoring setup; marks `onboarded_at` on completion; new/un-onboarded users redirected here after Google OAuth
- `/docs` — API reference (Vue page, migrated from static HTML)
- `/terms` — Terms of Service
- `/privacy` — Privacy Policy
- `/compare` — Compare two saved reports by ID
- `/report/[id]` — Saved report viewer (page/site/multi replay) + Issue Fix Tracker (Pro+, T1-4)
- `/report/crawl-diff` — Side-by-side site crawl comparison
- `/report/share/[token]` — Public white-label share page
- `/widget` — Embeddable audit widget (API key auth)
- `/error` — Nuxt error page

---

## Embeddable Widget

- `public/widget.js` — `<script data-key="...">` loader: creates iframe pointing to `/widget?key=...`
- `pages/widget.vue` — iframeable audit page, no nav, compact results
- `server/routes/widget-audit.post.ts` — API key gated, no PDF, returns score/grade/results
- Lead capture: email stored in `widget_leads` table, viewable in account page
- Agency only

---

## PDF Templates

- `templates/report.hbs` — Page + site audit PDF (dark theme, A4)
  - Cover page: full-bleed dark bg, large grade letter, score, URL, category tags, date
  - Category scores: 2×2 grid with colored top borders (T1-13 redesign)
  - Top 5 Issues box: highlighted red-tinted panel, numbered list with check + message (T1-13)
  - Category color chips on every result row name (T1-13)
  - AI summary verdict if available
  - Full results grouped by category: Technical / Content / AEO / GEO
- `templates/multi-report.hbs` — Compare audit PDF
- Agency branding: logo URL from `users.pdf_logo_url` if set
- `utils/generatePDF.js`: `addOne` Handlebars helper; `top5Fails` slice passed to template
