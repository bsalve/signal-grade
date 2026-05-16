# Claude Project Memory — SearchGrade

Read this file at the start of every session.

---

## Global CSS Classes (shared between Vue components and vanilla JS in app-main.js)

These classes are defined globally in `assets/main.css`. **Always reuse them — do not duplicate in scoped styles or inline.**

| Pattern | Classes |
|---------|---------|
| Filter bar | `.filter-bar`, `.filter-search`, `.filter-group`, `.filter-chip`, `.filter-chip.active`, `.filter-count` |
| Pagination | `.pagination-bar`, `.pg-arrow`, `.pg-num`, `.pg-num.active`, `.pg-ellipsis`, `.pg-input` |
| Score/grade display | `.report-grade`, `.report-score`, `.score-delta`, `.delta-up`, `.delta-down` |
| Select inputs | `.sg-select` |
| Re-audit button states | `.bulk-reaudit-btn.auditing`, `.bulk-reaudit-btn.done` |

When adding new UI patterns that appear in more than one context, define in `main.css` first, then reference by class name everywhere.

---

## What This Project Is

SearchGrade is an all-encompassing search visibility audit platform — the goal is to be the single most complete tool for auditing a site's performance across traditional SEO, AEO (Answer Engine Optimization — featured snippets, voice, People Also Ask), and GEO (Generative Engine Optimization — citations in ChatGPT, Perplexity, Gemini). Every audit produces a scored, graded report with actionable recommendations and a dark-themed PDF export.

**Tagline:** "Score your site across Google, and across AI."

Two modes:
- **CLI** (`node index.js <url>`): runs audits, prints report to stderr, JSON to stdout, saves PDF to `/output`
- **Web server** (`npm run dev` → Nuxt 3 on port 3000, `npm start` → production): full SaaS UI with auth, accounts, billing, report history

**100+ checks** across four categories: **Technical**, **Content**, **AEO**, **GEO**.

---

## Project Layout

Key files (see README for the full directory tree):

```
index.js              # CLI entry — auto-loads audits, scores, outputs report + JSON + PDF
nuxt.config.ts        # Nuxt 3 config; security.rateLimiter: false (see note #16)
audits/               # One .js file per check — auto-discovered at startup
pages/
  index.vue           # Main audit page — Page / Site / Bulk / Compare tab toggle
  dashboard.vue       # Report history, category sparklines, AI Visibility, crawl diff chips
  account.vue         # Account / billing / API keys / webhooks / notifications
  pricing.vue         # Publicly accessible pricing page
  docs.vue            # API reference (migrated from public/docs.html)
  terms.vue           # Terms of Service (migrated from public/terms.html)
  privacy.vue         # Privacy Policy (migrated from public/privacy.html)
  compare.vue         # Multi-URL comparison audit UI
  onboarding.vue      # 3-step onboarding wizard — new users redirected here after first Google OAuth login
  widget.vue          # Embeddable audit widget (API key auth)
  report/
    [id].vue          # Saved report viewer — replays stored results via _sgReplayData; handles page/site/multi audit types
    crawl-diff.vue    # Side-by-side crawl comparison diff view
    share/[token].vue # Public shareable report page (white-label aware, no auth)
  error.vue           # Nuxt error page
components/
  AppNav.vue          # Sticky navbar — brand + .nav-links slot
  AppNavAuth.vue      # Auth widget — uses useRoute() for auto active-state on NAV_LINKS; no slot needed from pages
  AppFooter.vue       # Shared footer
public/
  app-main.js         # Vanilla JS for the homepage audit UI (1400+ lines)
  widget.js           # Embeddable iframe loader (~15 lines)
  docs.html           # API reference (static HTML)
assets/
  main.css            # Global CSS — design tokens, animations, shared component styles
utils/
  fetcher.js          # axios + cheerio → { html, $, headers, finalUrl, responseTimeMs }
  score.js            # normalizeScore, calcTotalScore, letterGrade, calcCatScore, gradeSummary
  generatePDF.js      # Handlebars + Puppeteer → PDF (reads report.hbs fresh each call)
  crawler.js          # BFS site crawler — crawlSite(), aggregateResults()
  pageWorker.js       # Per-page worker thread (1 GB V8 heap cap, 45s timeout)
  detectDuplicates.js      # Post-crawl: duplicate titles, meta descriptions, body content
  detectOrphans.js         # Post-crawl: orphan pages + internal link equity
  detectClickDepth.js      # Post-crawl: pages >3 clicks from root
  detectCannibalization.js # Post-crawl: pages with similar title keywords (Jaccard >0.6)
  detectThinContent.js     # Post-crawl: pages with <300/500 words
  detectSlowPages.js       # Post-crawl: pages with responseTimeMs ≥800/1800ms
  gsc.js              # Google Search Console API helper (token refresh + searchAnalytics)
  webhooks.js         # HMAC-SHA256 signed webhook dispatcher
  gemini.js           # Groq LLM wrapper (callGemini, GROQ_TEMPERATURE=0.1) — AI meta, fix recs, exec summary
  aiVisibility.js     # AI Visibility scanner — inferCategory + 10-query scan (awareness/discovery/recommendation)
  notify.js           # Notification dispatcher — email + webhook for scheduled audit results
  ga4.js              # Google Analytics 4 API helper
  detectLinkOpportunities.js # Post-crawl: internal link opportunity detection
  auditRunner.js      # Fetch page + run audit modules; returns results/score/grade
  runAudit.js         # Full audit orchestrator — fetch, run, PDF, R2 upload, DB save
  r2.js               # Cloudflare R2 client — optional PDF cloud storage
  email.js            # Resend email helper — scheduled audit result emails
  tiers.js            # TIERS, ANON_RATE_LIMIT, getTier()
  db.js               # Knex instance — returns null if DATABASE_URL not set
server/
  plugins/audits.ts   # Loads all audit modules once at Nitro startup via readdirSync
  middleware/
    00.apiKeyAuth.ts  # Bearer token API key auth (sets event.context.apiKeyUser)
    01.rateLimit.ts   # In-memory rate limiter (attaches event.context.tier/plan/userId)
  routes/
    audit.post.ts           # Page audit — fetch, run checks, score, save, PDF
    multi-audit.post.ts     # Compare audit (multi-location, up to 10 URLs)
    bulk-audit.post.ts      # Bulk URL audit (array of URLs, no PDF)
    crawl.get.ts            # SSE site crawl with worker threads
    widget-audit.post.ts    # Widget audit (API key gated, no PDF)
    auth/google.get.ts      # Google OAuth (redirect + callback via nuxt-auth-utils)
    auth/logout.get.ts      # clearUserSession + redirect to /
    checkout.post.ts / billing-portal.post.ts / webhooks/stripe.post.ts
  api/
    me.get.ts                    # { user, limits } from session + event.context.tier
    dashboard-data.get.ts        # Report history + siteDiffGroups + parsedLocations
    account-data.get.ts          # Plan info, usage, PDF logo URL
    gsc-data.get.ts              # Google Search Console searchAnalytics for a URL
    ga4-data.get.ts              # Google Analytics 4 data for a URL
    generate-meta.post.ts        # AI meta tag generator (Groq/llama, pro/agency)
    ai-exec-summary.post.ts      # On-demand AI executive summary; saves to ai_summary column (pro/agency)
    ai-fix-rec.post.ts           # AI fix recommendation per failing check (Groq/llama, pro/agency)
    ai-visibility.post.ts        # AI Visibility scan — 10 queries × 3 categories (pro/agency)
    ai-visibility-history.get.ts # AI Visibility history + weekly sparkline + latestScan (SCAN_BATCH_SIZE=10)
    cwv-history.get.ts           # Core Web Vitals history for a URL
    content-brief.post.ts        # AI content brief (pro/agency)
    topic-coverage.post.ts       # Topic coverage analysis (pro/agency)
    robots-test.post.ts          # Test URL against robots.txt rules
    widget-leads.get.ts / widget-leads.post.ts  # Widget lead capture
    reports/[id]/index.get.ts    # Fetch single report with parsed results_json + meta_json
    reports/crawl-diff.get.ts    # Two-crawl diff: ?a=ID1&b=ID2
    reports/[id]/share.post.ts   # Generate public share token
    share/[token].get.ts         # Fetch public report by share token
    keys/ · scheduled/ · webhooks/
    account/branding.post.ts     # Save brand color for white-label share pages (agency)
    account/notify.post.ts       # Save notification channel settings
    account/pdf-logo.patch.ts    # Save PDF logo URL
    account/onboarded.patch.ts   # Mark onboarding complete (sets onboarded_at = now())
    account/index.delete.ts      # Delete account + all data
    reports/[id]/fixes.patch.ts  # Upsert fix tracker status { checkName, status } → report_fixes
db/migrations/        # 001–022: users, reports, api_keys, sessions, webhooks, share_tokens, google_tokens, pdf_logo, soft_delete, meta_json, cat_scores, ai_cache, notify_channels, brand_color, widget_leads, cwv_history, ai_visibility (ai_visibility_scans table), ai_visibility_category (query_category + inferred_category columns), onboarding (onboarded_at on users), report_fixes (report_fixes table for fix tracker)
templates/
  report.hbs          # Handlebars PDF (page + site) — read fresh each call
  multi-report.hbs    # Handlebars PDF (compare audit)
```

---

## Audit Modules (100+ checks)

Auto-discovered from `/audits/` at Nitro startup. Each exports:
```js
module.exports = function ($, html, url, meta) {
  return { name, status, score?, maxScore?, message, details?, recommendation? }
  // meta = { headers, finalUrl, responseTimeMs }
  // May return an array of result objects
}
```

**Naming convention:** Prefix `name` with `[Technical]`, `[Content]`, `[AEO]`, or `[GEO]`. Unprefixed → Technical section.

Full check list in README. Categories: Technical (41+), Content (20+), AEO (13+), GEO (20+).

---

## Scoring (`utils/score.js`)

- With `score`: `Math.round((score / (maxScore ?? 100)) * 100)`
- Without: pass=100, warn=50, fail=0
- `totalScore` = arithmetic mean across all checks
- Grades: A≥90, B≥80, C≥70, D≥60, F<60
- `calcCatScore(results, prefix)` — average normalized score for a category prefix
- **Server caches `score.js` at startup** — restart required after changes

---

## Web UI (`public/app-main.js` + `assets/main.css`)

### Design Tokens
```css
--bg: #0b0c0e; --bg2: #111214; --border: #1e2025; --dim2: #2a2d35;
--text: #e4e6ea; --muted: #8892a4; --accent: #4d9fff;
--warn: #ffb800; --fail: #ff4455; --pass: #34d399;
```

### Typography
- Body/UI: **Inter** (Google Fonts) — all labels, descriptions, recommendations
- Score/data: **Space Mono** — numbers, grade letters, stat counts, CLI elements, buttons

### Category Colors (hardcoded inline — not CSS variables)
- Technical: `#8892a4` · Content: `#e8a87c` · AEO: `#7baeff` · GEO: `#b07bff`

### Shared Score Hero
Both page and site audits call the same functions in `app-main.js`:
```js
buildScoreHero({ grade, score, color, pass, warn, fail, catScores, idPrefix, auditLabel, auditUrl })
// idPrefix: 'page' | 'site' — namespaces all element IDs (e.g. pageGradeDisplay, siteStatsRow)
// Returns HTML: audit header + grade letter + score counter/meter + stats row + 4 category pillars
// Derives summary text from GRADE_LABELS[grade] internally

animateScoreHero(idPrefix, score)
// Adds .in classes, runs countUp() on score counter, sets meter fill width
```

### Progress UI
- **Page audit:** fake `STEPS` array drives the bar. **Update `STEPS` in `app-main.js` + restart server when adding audit checks.**
- **Site audit:** real SSE `progress` events drive the bar.

---

## ⚠ Do Not Repeat

**Colors & theme:**
1. **Color separation** — `--pass` (green) = pass status + A-grade ONLY. `--accent` (blue) = links, hover, UI chrome. Category colors are independent from `--accent` — never unify.
2. **Hardcoded hex values** — When changing a theme color, grep for hex values. Stale hardcoded hex has shipped before.
3. **`gradeColor()` scope** — Only for the overall score meter. Result row bars must use status color directly. `gradeColor()` maps 80–89 → blue, which breaks green-status bars.
4. **AEO/GEO contrast** — Confirmed readable: AEO = `#7baeff`, GEO = `#b07bff`. Values `#4a5ea8`/`#6a4a98` are unreadable on `#0b0c0e`.

**PDF generation:**
5. **Puppeteer dark background** — `page.setContent()` strips backgrounds. Use `page.goto('file:///')` with a temp file. Requires `--force-color-profile=srgb` + `--run-all-compositor-stages-before-draw` launch args.
6. **`displayHeaderFooter` white bars** — Disable entirely; embed metadata in HTML body instead.
7. **PDF performance** — Never use `box-shadow`, `opacity` on overlapping elements, or `transition`/`animation` in `report.hbs`.

**Layout & CSS:**
8. **Stacked bar width** — `.site-stacked-bar` must be a direct child of `.result-row` with `grid-column: 1 / -1`.
9. **Windows scrollbar shift** — `html { scrollbar-gutter: stable; }` on every page prevents layout shift.
10. **Navbar wordmark weight** — Explicitly set `font-weight: 400` on `.nav-brand` in every template.
11. **Stale container dimensions** — After layout changes, grep for old pixel values.

**Nuxt / Nitro:**
12. **`createRequire` paths — CRITICAL** — Always `join(process.cwd(), 'utils/foo.js')`. Relative paths resolve from `.nuxt/dev/index.mjs` (the bundle), not the source file. Applies to all routes, middleware, plugins, and API handlers.
13. **`public/index.html` overrides routes** — Nuxt serves `public/` first. Delete any stale `public/index.html`.
14. **TypeScript in `<script setup>`** — Requires `lang="ts"` or vite-node crashes silently. Delete `.nuxt/` after fixing.
15. **New audit files need a restart** — `audits.ts` caches the list. Also update `STEPS` in `app-main.js`.
16. **nuxt-security rate limiter** — Built-in rate limiter in the `nuxt-security` module is SEPARATE from `01.rateLimit.ts`. It applies to all requests including page loads and causes 429s on rapid navigation. Already disabled via `security: { rateLimiter: false }` in `nuxt.config.ts`. Do NOT re-enable.

**Vue / data fetching:**
17. **SSR cookies not forwarded** — Use `useUserSession()` for profile/plan data. Use `ref(null)` + `$fetch` in `onMounted` for reports/counts (`useAsyncData` SSR caching causes stale empty-state renders).
18. **Nav links live in AppNavAuth** — `AppNavAuth.vue` renders all 4 nav links directly using `useRoute()` for active detection. Do NOT go back to injecting them as slot content from pages — that was the old pattern before this refactor.
19. **Vite HMR on `output/`** — Already suppressed in `nuxt.config.ts` with `vite.server.watch.ignored`.
20. **`getElementById` guards** — Always: `const el = document.getElementById('x'); if (el) ...`
21. **PDF download hrefs** — Always interpolate `data.pdfFile` into href (`/output/${pdfFile}`). Placeholder `/download` hrefs have shipped broken before.

**Crawler / audits:**
22. **Non-HTML files in crawler** — Filter by `NON_HTML_EXTENSIONS` + check `Content-Type`. Binary files take 20–40s and produce garbage DOM.
23. **Audit re-fetching causes OOM** — Audits must use `$`/`html` passed in — never call `axios.get(url)`. Each re-fetch = 50–100 MB cheerio DOM; across 50 pages = OOM.
24. **`.pdf-link` is invisible by default** — `assets/main.css` sets `opacity: 0`. Always add class `pdf-link in`.
25. **Vue scoped CSS + dynamic elements** — Scoped CSS never applies to elements rendered via `innerHTML` or `$fetch`-rendered content in `onMounted`. Use Vue template with `v-if`/`v-else`. Never attach both `@click` and `addEventListener` to the same element.
26. **Non-scoped `<style>` in Vue SFCs leaks globally** — Any `<style>` block without `scoped` injects CSS into the global scope for all pages once that component is visited. Use parent-scoped selectors (e.g. `.my-page-wrap #results { ... }` not `#results { ... }`) for all overrides in non-scoped blocks.
27. **app-main.js inline HTML class names must match actual DOM classes** — When generating HTML with inline `onclick` handlers that query elements by class (e.g. `document.querySelector('.multi-loc-url')`), verify the class matches exactly what `innerHTML` produces. Wrong class → querySelector returns null → silent failure. Always grep `addMultiRow`/equivalent generator to confirm class names before writing query code.
28. **PDF downloads: serve bytes, not static redirects** — `sendRedirect(event, '/output/file.pdf')` only works if that path is statically served. In dev mode `publicAssets` is unreliable. Always use `readFileSync` + `setResponseHeaders` to send PDF bytes directly from `download.get.ts`, or rely on the existing `server/routes/output/[...path].get.ts` route for live audit PDF links.
29. **Bulk reports have no PDF** — `bulk-audit.post.ts` never calls `generatePDF`. Always guard PDF download links with `v-if="report.pdf_filename"` in the dashboard.
30. **app-main.js page-level functions are absent outside the index page** — `setMode()`, `addMultiRow()`, etc. are defined in `app-main.js` which loads on every page, but they reference DOM elements (`modePageBtn`, `singleInputWrap`, etc.) that only exist on `/` (index.vue). Calling them from a button on `/report/[id]` silently fails. Pattern: guard with `document.getElementById('modePageBtn')` — if absent, redirect to `/?paramName=value` and handle the param in `_sgInit()` to activate the mode with the value pre-filled after navigation.

---

## Auth & Dashboard

**Stack:** nuxt-auth-utils sealed cookie sessions + Google OAuth (`defineOAuthGoogleEventHandler`).

**ENV variables:**
```
DATABASE_URL=postgresql://...
NUXT_SESSION_PASSWORD=<32+ chars>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google
STRIPE_SECRET_KEY=...  STRIPE_WEBHOOK_SECRET=...  STRIPE_PRO_PRICE_ID=...  STRIPE_AGENCY_PRICE_ID=...
RESEND_API_KEY=...     EMAIL_FROM=SearchGrade <noreply@yourdomain.com>
GEMINI_API_KEY=...     # [GEO] AI Search Presence check (Gemini grounding for web citations)
GROQ_API_KEY=...       # AI Meta Generator + AI Fix Recommendations + AI Executive Summary
PAGESPEED_API_KEY=...  # Optional — raises PSI from ~400 req/day/IP
```

**DB tables** (`npm run migrate`):
- `users` — id, google_id, name, email, avatar_url, plan, pdf_logo_url, brand_color, notify_email, notify_webhook_url
- `reports` — id, user_id, url, audit_type, score, grade, pdf_filename, r2_key, locations, results_json, meta_json, cat_scores_json, ai_summary, ai_recs_json, share_token, deleted_at
  - `meta_json` stores: site audit → `{ depthDistribution, dirCounts, linkEquity, responseStats, aiSummary }`; multi/compare audit → `{ locations: [...full per-location result objects] }` (used by the report viewer to replay compare audits)
  - `ai_recs_json` stores keyed cache: `[checkName]` for fix recs, `__comparison_insight__` for compare audit AI card, `__meta_title__`/`__meta_desc__` for meta generator
- `api_keys` — id, user_id, key_hash, label, last_used_at
- `scheduled_audits` — id, user_id, url, frequency, last_run_at, enabled
- `webhooks` — id, user_id, url, secret, events[]
- `ai_visibility_scans` — id, user_id, domain, platform, query, query_category, inferred_category, mentioned, sentiment, excerpt, created_at
- `cwv_history` — id, user_id, url, lcp_ms, cls, performance_score, created_at
- `widget_leads` — id, api_key_id, url, email, name, created_at

**⚠ Google Cloud Console:** Authorized redirect URI = `http://localhost:3000/auth/google` (not `/callback`). Update when changing environments.

**`utils/db.js`** — returns Knex instance or `null`. All DB calls guard against `null` so the server runs without a database.

---

## Server Notes (Nitro / Nuxt 3)

- **CJS/ESM bridge:** All Nitro `.ts` files use `import { createRequire } from 'module'` + `const _require = createRequire(import.meta.url)` + `join(process.cwd(), ...)` absolute paths.
- **h3 v1.x SSE:** `createEventStream(event)` → push via `stream.push(JSON.stringify(obj))` → `return stream.send()`. `sendEventStream` does not exist in h3 v1.x.
- **`defineOAuthGoogleEventHandler`** from nuxt-auth-utils handles both OAuth redirect and callback in one route.
- **Startup-cached modules:** `server/plugins/audits.ts`, `crawler.js`, `score.js` — restart required after changes.
- **`/crawl` SSE event shapes:** `{ type:'progress', crawled, total, url }` · `{ type:'done', pageCount, results, pdfFile, aiSummary?, siteScore, siteGrade, siteReportId }` · `{ type:'error', message }`
- **Site score sync** — `crawl.get.ts` emits `siteScore`/`siteGrade` in the `done` event. `renderSiteResults` in `app-main.js` prefers these over its own client-calculated score to ensure the live result matches the DB. Always pass both fields; the client falls back to its own calculation only if absent.

---

## Site Audit (`utils/crawler.js` + post-crawl detectors)

BFS crawler, same-origin only, max 50/200/500 pages (Free/Pro/Agency). Worker thread per page (1 GB V8 heap, 45s timeout). `aggregateResults(pages)` → sorted by fail count.

**Post-crawl detectors** (called in `crawl.get.ts` after crawl completes):
- `detectDuplicates` — duplicate titles, meta descriptions, body content
- `detectOrphans` — orphan pages + internal link equity
- `detectClickDepth` — pages >3 clicks from root
- `detectCannibalization` — pages with Jaccard title similarity >0.6
- `detectThinContent` — pages with <300 words (fail), 300–500 (warn)
- `detectSlowPages` — pages with responseTimeMs ≥1800ms (fail), 800–1799ms (warn)

**Audits skipped in site crawl** (too slow / domain-level):
`checkPageSpeed`, `technicalBrokenLinks`, `technicalCanonicalChain`, `contentOGImageCheck`, `technicalRedirectChain`, `checkCrawlability`, `technicalRobotsSafety`, `geoLlmsTxt`, `geoAICrawlerAccess`, `technicalSitemapValidation`, `technicalCrawlDelay`, `geoAIPresence`, `contentSpelling`, `technicalAMP`

---

## Known Issues & Pre-Launch Checklist

- `titleTag.js`, `metaDescription.js`, and `checkMetaTags.js` overlap (intentional redundancy)
- **⚠ UNTESTED — Google Search Console** — Requires verified GSC property under authenticated account
- **⚠ UNTESTED — AI Meta Generator** — Requires `GROQ_API_KEY` + Pro plan; click "Generate →" on failing title/meta
- **⚠ UNTESTED — Bulk Audit** — Paste 3+ URLs into Bulk tab, click Run
- **⚠ TODO — PDF overhaul** — PDF reports (`templates/report.hbs`, `templates/multi-report.hbs`, `utils/generatePDF.js`) need a full redesign pass: better typography, layout, cover page, and brand consistency. Currently functional but minimal. Schedule as a dedicated feature sprint.

---

## TODO

- **AI Visibility — multi-platform** — currently Groq-only (`llama-3.1-8b-instant`). Consider adding Gemini as a second platform (schema already has `platform` column). Each platform gets its own scan batch; dashboard shows per-platform breakdown or averaged score.

---

## Global Rules

- Run tests after changes *(no test suite yet — add one)*
- Ask before committing
- Keep code simple
- **Reuse CSS** — shared styles belong in `assets/main.css`, not duplicated in component scoped styles. Similar or identical UI patterns (score displays, pagination, filter chips, grade badges) must use the same CSS classes throughout the site. When adding a new UI pattern, check `main.css` first — if the pattern appears in more than one context, define it globally.
- **American English** throughout — optimize, color, behavior, favor, recognize, analyze.
- **Always provide testing instructions after implementing features.** For every feature or fix, give the user explicit step-by-step instructions to manually verify it works — including any required setup (env vars, DB state, plan tier, sign-in steps). Features are not considered complete until the user has tested them. After giving testing instructions, append them verbatim on the bottom of `.claude/untested.md` under a `## Feature Name` heading so the user has a persistent checklist.
- **As features are implemented, add them to `.claude/features.md`** under the appropriate section. This file is the canonical record of what has been built. Read it before planning to avoid re-implementing existing features.
