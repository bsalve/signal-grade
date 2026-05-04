# SearchGrade

**Score your site across Google, and across AI.**

A Node.js tool for auditing a website's search visibility across four signal categories: **Technical** (site infrastructure), **Content** (on-page marketing signals), **AEO** (Answer Engine Optimization — featured snippets, voice), and **GEO** (Generative Engine Optimization — ChatGPT, Perplexity, Gemini). Run a **Page Audit** for a single URL, a **Site Audit** to crawl up to 50 pages, a **Bulk Audit** across a list of URLs, or a **Compare Audit** for side-by-side competitor comparisons. Available as a **CLI** or **web UI** with animated results and PDF export.

---

## Requirements

- Node.js >= 18
- PostgreSQL (optional — required only for user accounts and report history)

---

## Installation

```bash
git clone https://github.com/bsalve/search-grade.git
cd search-grade
npm install
```

---

## Modes

### Web UI (recommended)

```bash
# Development (hot reload, port 3000)
npm run dev

# Production build + start
npm run build
npm start
```

Opens `http://localhost:3000`. Use the **Page Audit / Site Audit / Compare** toggle above the URL input.

#### Page Audit (default)
Runs all 82 checks against a single URL. When the audit finishes:
- A letter grade and animated score counter appear
- Per-category scores (Technical / Content / AEO / GEO) appear as mini score cards
- Results are grouped **Technical → Content → AEO → GEO** with color-coded headers
- Each result shows a status icon, score bar, and expandable recommendation
- A **Download PDF Report** button saves a dark-themed A4 PDF to `/output`

#### Site Audit
Crawls up to 50 pages (free tier) within the same domain via a worker-thread BFS crawler. Progress is driven by real SSE events — the status line shows each URL as it's fetched. When complete:
- Summary stats show how many checks have failures, warnings, or all-passing pages
- **Top Issues** section lists the 7 checks affecting the most pages
- **Issue Breakdown** lists every check with a stacked pass/warn/fail bar; click to expand affected URLs
- **What's Working** (collapsed) lists all-passing checks
- **Download Sitemap XML** generates a standards-compliant `sitemap.xml` from all crawled URLs
- Generates a site-wide PDF report (`searchgrade-site-report-*.pdf`)

Site-only post-crawl checks (not run per-page):
- **Duplicate Page Titles** — flags pages sharing an identical title tag
- **Duplicate Meta Descriptions** — flags pages sharing an identical meta description
- **Orphan Pages** — flags crawled pages with no inbound links from other crawled pages

#### Bulk URL Audit
A fourth mode that runs page audits against a list of URLs (up to the plan limit) and returns a sortable comparison table. Paste URLs one per line, click Run, and get a table with grade, score, fail/warn/pass counts, and top issues per URL. Includes CSV export.

#### Compare Audit
Runs page audits against up to 10 URLs in parallel and renders a side-by-side competitor comparison. Results include:
- Per-location grade card with overall score, grade, and category scores (T / C / A / G)
- **Common Issues** section ranked by how many locations they affect
- **Check Comparison** table — all 82 checks × all locations, with ✓ / △ / ✕ icons and scores
- CSV export of the full comparison table
- Generates a PDF comparison report (`searchgrade-multi-report-*.pdf`)

### CLI

```bash
node index.js <url>
```

Prints a human-readable report to `stderr`, structured JSON to `stdout`, and saves a PDF to `/output`.

```bash
# Terminal report + PDF
node index.js https://example.com

# Save JSON to a file
node index.js https://example.com > result.json

# Pipe into jq
node index.js https://example.com 2>/dev/null | jq '.grade'
```

---

## Grading Scale

| Score  | Grade | Meaning |
|--------|-------|---------|
| 90–100 | A     | Excellent — strong SEO, AEO, and GEO signals across the board |
| 80–89  | B     | Good — core signals solid; targeted improvements would push this higher |
| 70–79  | C     | Average — several signals are missing or weak |
| 60–69  | D     | Poor — significant gaps in SEO foundations and AI-readiness signals |
| 0–59   | F     | Critical — foundational elements and AI optimization signals are missing |

Total score is the arithmetic mean of all normalized check scores (each scaled 0–100). Per-category scores (Technical / Content / AEO / GEO) are shown separately with individual letter grades.

---

## Audit Checks — 100+

All modules live in `/audits` and are auto-discovered — adding a new `.js` file is all that's needed.

### Technical — Site Health & Infrastructure (41 checks)

| File | Check | Score |
|---|---|---|
| `checkSSL.js` | HTTPS active, certificate valid, days until expiry | 0–100 |
| `checkPageSpeed.js` | Google PageSpeed Insights performance score | 0–100 |
| `checkPageSpeed.js` *(2nd result)* | Mobile friendliness via Lighthouse SEO audits | 0–100 |
| `checkPageSpeed.js` *(3rd result)* | Core Web Vitals — LCP, TBT, CLS thresholds | 0–100 |
| `checkCrawlability.js` | `/robots.txt` and `/sitemap.xml` exist and are valid | 0–100 |
| `technicalSitemapValidation.js` | HEADs up to 15 sitemap `<loc>` URLs; scores by % reachable | 0–100 |
| `checkCanonical.js` | `<link rel="canonical">` present, non-empty, single tag | pass/warn/fail |
| `technicalCanonicalChain.js` | Canonical chain detection — A→B→C points-elsewhere chain | 0–100 |
| `checkMetaRobots.js` | Detects accidental noindex / nofollow / none directives | pass/warn/fail |
| `technicalMobileViewport.js` | `<meta name="viewport">` presence and `width=device-width` | 0–100 |
| `technicalIndexability.js` | noindex in meta/header + canonical-points-elsewhere | 0–100 |
| `contentInternalLinks.js` | Internal link count — 0: fail, 1–2: warn, 3–9: pass, 10+: 100 | 0–100 |
| `technicalBrokenLinks.js` | HEADs up to 20 internal links for 4xx/5xx responses | 0–100 |
| `technicalRedirectChain.js` | Follows redirect chain — scored by hop count and type | 0–100 |
| `technicalMixedContent.js` | HTTP assets (img/script/iframe/link) on HTTPS pages | 0–100 |
| `technicalSecurityHeaders.js` | HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy | 0–100 |
| `technicalCSP.js` | Content-Security-Policy header presence and enforcement mode | 0–100 |
| `technicalXRobotsTag.js` | X-Robots-Tag response header — detects noindex directive | 0–100 |
| `technicalCompression.js` | gzip / Brotli / zstd via Content-Encoding response header | pass/fail |
| `technicalCacheControl.js` | Cache-Control header — max-age, no-store, revalidation | 0–100 |
| `technicalResponseTime.js` | TTFB — Good <800ms, Needs Improvement <1800ms, Poor ≥1800ms | 0–100 |
| `technicalHTTPVersion.js` | HTTP/2 or HTTP/3 detection via response headers | 0–100 |
| `technicalFavicon.js` | `<link rel="icon">` in DOM or `/favicon.ico` reachable | 0–100 |
| `technicalImageDimensions.js` | `<img>` missing width+height attributes (CLS risk) | 0–100 |
| `technicalLazyLoading.js` | `loading="lazy"` on below-fold images | 0–100 |
| `technicalRenderBlocking.js` | Sync `<script src>` in `<head>` without defer/async | 0–100 |
| `technicalPreconnect.js` | `<link rel="preconnect">`, dns-prefetch, or preload hints | 0–100 |
| `technicalMinification.js` | `.min.` filename heuristic on external JS/CSS assets | 0–100 |
| `technicalWebManifest.js` | `<link rel="manifest">` presence; apple-touch-icon fallback | 0–100 |
| `technicalBreadcrumbSchema.js` | BreadcrumbList JSON-LD with itemListElement entries | 0–100 |
| `technicalSchemaInventory.js` | Lists all JSON-LD `@type` values found on page | pass/warn/fail |
| `technicalSchemaValidation.js` | Required field validation for detected schema types | 0–100 |
| `schema.js` | JSON-LD LocalBusiness entity presence | pass/warn/fail |
| `technicalBusinessHours.js` | LocalBusiness openingHoursSpecification completeness | 0–100 |
| `technicalAggregateRating.js` | AggregateRating schema with ratingValue + ratingCount | 0–100 |
| `technicalGeoCoordinates.js` | GeoCoordinates (latitude + longitude) in LocalBusiness | 0–100 |
| `technicalHreflang.js` | `<link rel="alternate" hreflang>` — presence, x-default, malformed | 0–100 |
| `technicalRobotsSafety.js` | Dangerous `Disallow:` rules — blocks site or CSS/JS files | 0–100 |
| `technicalCrawlDelay.js` | `Crawl-delay:` directive in robots.txt — large values harm crawl budget | 0–100 |
| `technicalAccessibility.js` | lang attribute, `<main>` landmark, labeled inputs, skip nav link | 0–100 |
| `technicalPagination.js` | `<link rel="next">` / `<link rel="prev">` detection | pass/warn/fail |

### Content — Marketing & On-Page Signals (18 checks)

| File | Check | Score |
|---|---|---|
| `checkMetaTags.js` | Title (30–60 chars) + meta description (70–160 chars) combined | 0–100 |
| `titleTag.js` | Title tag presence and length | pass/warn/fail |
| `metaDescription.js` | Meta description presence and length | pass/warn/fail |
| `headings.js` | Exactly one H1 tag present | pass/warn/fail |
| `contentHeadingHierarchy.js` | H2/H3 ordering — H3 must follow H2 | pass/warn/fail |
| `contentWordCount.js` | Body word count — scored proportionally, pass at 300+ words | 0–100 |
| `checkImageAlt.js` | Percentage of `<img>` tags with alt attributes | 0–100 |
| `checkOpenGraph.js` | og:title, og:description, og:image, og:url, twitter:card | 0–100 |
| `contentOGImageCheck.js` | og:image URL reachability via HEAD request | 0–100 |
| `contentBrandConsistency.js` | Brand name in title, H1, og:title, og:site_name | 0–100 |
| `checkNAP.js` | Phone number and street address in page text | 0–100 |
| `contentSocialLinks.js` | Links to social platforms — scored by count | 0–100 |
| `contentReadability.js` | Flesch-Kincaid Reading Ease — scored by readability band | 0–100 |
| `contentFreshness.js` | Publish/update date via meta, JSON-LD, `<time>`, or text | 0–100 |
| `contentOutboundLinks.js` | External links + authority domain links (.gov/.edu/Wikipedia) | 0–100 |
| `contentCallToAction.js` | CTA buttons/links/tel/mailto — scored by type count | 0–100 |
| `contentImageOptimization.js` | WebP/AVIF usage, `<figcaption>` presence, absence of GIFs | 0–100 |
| `contentKeywordDensity.js` | Top 15 keyword frequencies from body text | 0–100 |

### AEO — Answer Engine Optimization (9 checks)

Signals for featured snippets, People Also Ask, and voice assistant responses.

| File | Check | Score |
|---|---|---|
| `aeoFaqSchema.js` | FAQPage / QAPage / HowTo JSON-LD with populated Q&A pairs | 0–100 |
| `aeoArticleSchema.js` | Article/BlogPosting/NewsArticle — headline, author, datePublished, publisher, image | 0–100 |
| `aeoHowToSchema.js` | HowTo schema — step count and quality (name + text per step) | 0–100 |
| `aeoVideoSchema.js` | VideoObject schema — name, description, thumbnailUrl, uploadDate | 0–100 |
| `aeoSpeakable.js` | Speakable schema with CSS selectors that resolve in the DOM | 0–100 |
| `aeoQuestionHeadings.js` | H2/H3 headings phrased as questions | 0–100 |
| `aeoFeaturedSnippetFormat.js` | Opening paragraph length vs. 40–60 word featured snippet ideal | 0–100 |
| `aeoDefinitionContent.js` | `<dl>/<dt>/<dd>` definition lists and `<dfn>` elements | 0–100 |
| `aeoConciseAnswers.js` | Paragraphs in the 20–80 word snippet-ready range | 0–100 |

### GEO — Generative Engine Optimization (14 checks)

Signals for citation and representation in AI-generated answers.

| File | Check | Score |
|---|---|---|
| `geoEeat.js` | E-E-A-T: author byline, publish date, about link, contact link | 0–100 |
| `geoEntityClarity.js` | Org/LocalBusiness schema: name, description, url, sameAs, logo | 0–100 |
| `geoAuthorSchema.js` | Person JSON-LD — name, jobTitle, sameAs (LinkedIn etc.), image/url | 0–100 |
| `geoServiceSchema.js` | Service/Product JSON-LD — name, description, provider, areaServed | 0–100 |
| `geoGoogleBusinessProfile.js` | GBP URL in sameAs schema or as a visible page link | 0–100 |
| `geoServiceAreaContent.js` | areaServed in schema + geographic text mentions | 0–100 |
| `geoStructuredContent.js` | AI-parseable content: data tables, ordered lists, definition lists, heading depth | 0–100 |
| `geoCitations.js` | `<cite>`, attributed blockquotes, references heading, numbered refs | 0–100 |
| `geoReviewContent.js` | Testimonial signals: blockquotes, review classes, star patterns, attributed quotes | 0–100 |
| `geoPrivacyTrust.js` | Privacy policy link, terms of service link, cookie/GDPR notice | 0–100 |
| `geoMultiModal.js` | Embedded video (YouTube/Vimeo/etc. or `<video>`) and `<audio>` elements | 0–100 |
| `geoLlmsTxt.js` | `/llms.txt` AND `/llms-full.txt` — either present with ≥100 chars = pass; sparse = warn; both missing = fail | 0–100 |
| `geoAICrawlerAccess.js` | GPTBot, ClaudeBot, PerplexityBot, Googlebot-Extended access in robots.txt | 0–100 |
| `geoAIPresence.js` | Queries Gemini with Google Search grounding to check if site appears in AI search results for a brand query — cited in sources (100), mentioned in text (60), absent (0). Requires `GEMINI_API_KEY`. Skipped in site crawl. | 0–100 |

---

## Adding a New Audit

1. Create `/audits/yourCheck.js`
2. Export a function with the signature `($, html, url, meta)` returning a result object:

```js
// meta = { headers, finalUrl, responseTimeMs }
module.exports = function myCheck($, html, url, meta) {
  return {
    name: '[Technical] My Check', // prefix: [Technical], [Content], [AEO], or [GEO]
    status: 'pass',               // 'pass' | 'warn' | 'fail'
    score: 95,                    // optional — omit if pass/warn/fail is sufficient
    message: 'All good.',
    details: '...',               // optional
    recommendation: '...',        // include for warn/fail results
  };
};
```

3. Done — the CLI picks it up automatically. **Restart the web server** to load the new file (audits are discovered once at Nitro startup). Also add a corresponding entry to the `STEPS` array in `public/app-main.js` so the progress bar reflects the new check count.
4. If the check should be skipped during site crawls (e.g. it makes slow external API calls or domain-level HTTP requests), add its filename to the `SKIP_AUDITS` set in `utils/pageWorker.js`.

**Naming convention:** Prefix `name` with `[Technical]`, `[Content]`, `[AEO]`, or `[GEO]` to auto-group results in the UI and PDF. Unprefixed results appear in the Technical section.

---

## PDF Reports

Every audit produces a dark-themed A4 PDF saved to `/output`:

| Mode | Filename |
|---|---|
| Page Audit | `searchgrade-report-[domain]-[YYYY-MM-DD].pdf` |
| Site Audit | `searchgrade-site-report-[domain]-[YYYY-MM-DD].pdf` |
| Compare Audit | `searchgrade-multi-report-[YYYY-MM-DD].pdf` |

**Page/Site Audit PDF** includes: grade + score meter, pass/warn/fail stats, per-category scores, executive summary (top 7 issues + top 7 passes), full results table.

**Compare PDF** includes: per-location grade cards, best/worst summary, common issues across locations, full side-by-side check comparison table.

**Agency branding:** Pass a `logoUrl` in the Page Audit request body to replace the SEARCHGRADE wordmark with your agency logo. The URL must be `http/https` and is validated server-side.

---

## AI Features (Pro / Agency)

Requires `GROQ_API_KEY` in `.env`.

- **AI Meta Tag Generator** — On a page audit with a failing title or meta description, click "Generate →" to get an AI-generated suggestion (50–60 char title / 120–160 char description) based on the actual page content.
- **AI Fix Recommendations** — On any failing check, click "AI Fix →" to get a 1–2 sentence page-specific recommendation that references the actual content — not generic boilerplate. Responses are cached per report.
- **AI Executive Summary** — After any audit (page or site), a 2–5 sentence agency-ready summary of findings appears above the results, calling out the most critical issues and the single highest-priority action to take first.
- **SERP Snippet Preview** — After every page audit, a Google-style search result card shows exactly how the title, URL breadcrumb, and meta description will appear in SERPs. Length indicators are color-coded (green / amber / red).

---

## Dashboard Enhancements

- **Category Score Trending** — For domains with multiple page audits, the dashboard shows four sparklines tracking Technical / Content / AEO / GEO scores over time, in addition to the existing overall score trend.
- **Crawl Comparison (Diff View)** — When a domain has two or more site audits, a "Compare crawls" chip appears. Clicking it navigates to a diff view showing which checks improved (green), regressed (red), or stayed the same, with both audit dates and page counts shown in the header.
- **Saved Report Viewer** — Every saved report can be opened from the dashboard to replay the full audit results exactly as they appeared when generated.

---

## User Accounts, Report History & Pricing

SearchGrade supports optional Google OAuth sign-in backed by PostgreSQL. When enabled:

- A **Sign in** button appears in the navbar on the homepage
- Every completed audit (page, site, or compare) is automatically saved to the database
- Signed-in users can visit `/dashboard` to see their full report history with grade, score, date, PDF download, and share links
- Reports can be soft-deleted individually with an inline confirmation step (deleted reports are hidden but preserved in the database for usage accounting)
- **Shareable report links** — Pro/Agency users can generate a public share URL for any report from the dashboard
- **Scheduled audits** — Pro/Agency users can schedule recurring audits (weekly/monthly) from the `/account` page; results are emailed via Resend. Requires `RESEND_API_KEY` and `EMAIL_FROM`.
- `/account` shows the current plan, usage stats (audits this month, total reports saved), plan limits, billing management, and a link to upgrade
- Agency users can save a **PDF logo URL** on `/account` — it auto-applies to all PDFs they generate
- **Delete Account** — permanently deletes the account and all associated data with a typed confirmation
- `/pricing` shows the three plan tiers with feature lists, upgrade CTAs, and FAQ — publicly accessible without sign-in
- **Google Search Console integration** — after sign-in, page audit results for verified domains show a Search Console panel with top queries, clicks, impressions, and average position (last 28 days)

**Setup:**

1. Create a PostgreSQL database (local or hosted, e.g. [Neon](https://neon.tech))
2. Set up Google OAuth credentials in [Google Cloud Console](https://console.cloud.google.com) (APIs & Services → Credentials → OAuth client ID → Web application; add `http://localhost:3000/auth/google` as an authorized redirect URI)
3. Add to `.env`:

```
DATABASE_URL=postgresql://user:password@host/dbname
NUXT_SESSION_PASSWORD=<32+ char random string>
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google
```

4. Run the database migrations:

```bash
npm run migrate
```

The server runs without these variables — auth is simply disabled and audits work as normal.

---

## API Access

Pro and Agency plan users can generate API keys on the `/account` page and use them to run audits programmatically. Full API documentation is available at `/docs`.

**Authentication:** Pass the key as a Bearer token:
```
Authorization: Bearer sg_<your_key>
```

**Endpoints:**
- `POST /audit` — run a full page audit
- `GET /crawl?url=<url>` — run a site crawl (Server-Sent Events)

Rate limits match your plan tier (60/hr Pro, 200/hr Agency).

---

## Embeddable Widget

Agency plan users can embed a live audit widget on any page using a single script tag. Generate an API key on the `/account` page, then:

```html
<script src="https://searchgrade.com/widget.js" data-key="sg_YOUR_KEY"></script>
```

The widget renders an iframe at the script's location with a URL input and compact results display.

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `PAGESPEED_API_KEY` | Google PageSpeed Insights API key — optional, free tier ~400 req/day/IP |
| `DATABASE_URL` | PostgreSQL connection string — required for user accounts and report history |
| `NUXT_SESSION_PASSWORD` | 32+ character random string for sealing session cookies (nuxt-auth-utils) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID — from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret — from Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | OAuth redirect URI — use `http://localhost:3000/auth/google` for local dev |
| `STRIPE_SECRET_KEY` | Stripe secret key — required for paid plan upgrades |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret — required for plan upgrade webhooks |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for the Pro plan |
| `STRIPE_AGENCY_PRICE_ID` | Stripe Price ID for the Agency plan |
| `RESEND_API_KEY` | Resend API key — required for scheduled audit result emails |
| `EMAIL_FROM` | Verified sender address for Resend, e.g. `SearchGrade <noreply@yourdomain.com>` |
| `GEMINI_API_KEY` | Google Gemini API key — required for the `[GEO] AI Search Presence` check (uses Gemini grounding for web citations) |
| `GROQ_API_KEY` | Groq API key — required for AI Meta Generator, AI Fix Recommendations, and AI Executive Summary |

Set in a `.env` file at the project root.

---

## Project Structure

```
searchgrade/
├── index.js                  # CLI entry point
├── nuxt.config.ts            # Nuxt 3 / Nitro configuration
├── knexfile.js               # Database configuration
├── audits/                   # Auto-discovered audit modules (82 checks)
│   ├── check*.js             # Core checks (SSL, crawlability, meta tags, etc.)
│   ├── technical*.js         # Technical checks
│   ├── content*.js           # Content checks
│   ├── aeo*.js               # AEO checks
│   └── geo*.js               # GEO checks
├── pages/
│   ├── index.vue             # Homepage — Page / Site / Bulk / Compare audit UI
│   ├── dashboard.vue         # Report history, category sparklines, crawl diff chips (requires auth)
│   ├── account.vue           # Account, plan, billing, API keys, webhooks (requires auth)
│   ├── pricing.vue           # Pricing page — publicly accessible
│   ├── compare.vue           # Multi-URL comparison audit UI
│   ├── widget.vue            # Embeddable audit widget (API key auth)
│   ├── error.vue             # Nuxt error page
│   └── report/
│       ├── [id].vue          # Saved report viewer — replays stored results
│       ├── crawl-diff.vue    # Side-by-side crawl comparison diff view
│       └── share/[token].vue # Public shareable report page
├── components/
│   ├── AppNav.vue            # Shared sticky navbar
│   └── AppFooter.vue         # Shared footer
├── composables/
│   └── useAudit.ts           # Wraps /audit POST + /crawl SSE
├── stores/
│   └── user.ts               # Pinia user store
├── server/
│   ├── plugins/
│   │   └── audits.ts         # Loads all audit modules at Nitro startup
│   ├── middleware/
│   │   ├── 00.apiKeyAuth.ts  # Bearer token API key validation (runs before rate limiter)
│   │   └── 01.rateLimit.ts   # In-memory rate limiter + tier attachment
│   ├── routes/
│   │   ├── auth/
│   │   │   ├── google.get.ts # Google OAuth (redirect + callback via nuxt-auth-utils)
│   │   │   └── logout.get.ts # clearUserSession + redirect to /
│   │   ├── audit.post.ts     # Page audit — fetch, run checks, score, save, PDF
│   │   ├── multi-audit.post.ts # Compare audit (multi-location, up to 10 URLs)
│   │   ├── bulk-audit.post.ts  # Bulk URL audit (array of URLs, no PDF)
│   │   ├── crawl.get.ts      # SSE site crawl with worker threads
│   │   ├── widget-audit.post.ts # Widget audit (API key gated, no PDF)
│   │   ├── output/[...path].get.ts # Serves generated PDFs from /output
│   │   ├── checkout.post.ts  # Stripe Checkout session
│   │   ├── billing-portal.post.ts  # Stripe billing portal session
│   │   └── webhooks/stripe.post.ts # Stripe webhook handler
│   └── api/
│       ├── me.get.ts                    # { user, limits } from session
│       ├── dashboard-data.get.ts        # Report history query
│       ├── account-data.get.ts          # Plan info, usage counts, PDF logo URL
│       ├── gsc-data.get.ts              # Google Search Console data for a URL
│       ├── generate-meta.post.ts        # AI meta tag generator (Anthropic haiku, pro/agency)
│       ├── ai-fix-rec.post.ts           # AI fix recommendation per failing check (pro/agency)
│       ├── reports/
│       │   ├── [id]/index.get.ts        # Fetch single report with parsed results_json + meta_json
│       │   ├── [id].delete.ts           # Soft-delete report (verifies ownership)
│       │   ├── [id]/share.post.ts       # Generate public share token for a report
│       │   └── crawl-diff.get.ts        # Two-crawl diff: ?a=ID1&b=ID2
│       ├── share/[token].get.ts         # Fetch public report data by share token
│       ├── keys/
│       │   ├── index.get.ts             # List API keys for current user
│       │   ├── index.post.ts            # Generate new API key (plaintext shown once)
│       │   └── [id].delete.ts           # Revoke API key (verifies ownership)
│       ├── account/
│       │   ├── index.delete.ts          # Delete account + all data (cascade)
│       │   └── pdf-logo.patch.ts        # Save PDF logo URL for agency users
│       ├── scheduled/                   # Scheduled audit CRUD (pro/agency)
│       └── webhooks/                    # Webhook endpoint CRUD (pro/agency)
├── db/
│   └── migrations/           # Knex migration files (001–011: users, reports, sessions, api_keys, webhooks, share_tokens, google_tokens, pdf_logo, soft_delete)
├── public/
│   ├── app-main.js           # Vanilla JS for the homepage audit UI
│   ├── widget.js             # Embeddable iframe loader script
│   ├── docs.html             # API reference documentation
│   ├── privacy.html          # Privacy policy
│   └── terms.html            # Terms of service
├── templates/
│   ├── report.hbs            # Handlebars PDF template (page + site audit)
│   └── multi-report.hbs      # Handlebars PDF template (compare audit)
├── utils/
│   ├── fetcher.js            # axios + cheerio fetcher (returns headers, finalUrl, responseTimeMs)
│   ├── crawler.js            # BFS site crawler — crawlSite(), aggregateResults()
│   ├── pageWorker.js         # Per-page worker thread (isolated V8 heap, freed after each page)
│   ├── detectDuplicates.js   # Post-crawl: flags duplicate titles, meta descriptions, and body content
│   ├── detectOrphans.js      # Post-crawl: flags pages with no inbound links + link equity
│   ├── detectClickDepth.js   # Post-crawl: flags pages more than 3 clicks from the root
│   ├── detectThinContent.js  # Post-crawl: flags pages with <300 words (fail) or 300–500 (warn)
│   ├── detectSlowPages.js    # Post-crawl: flags pages with responseTimeMs ≥1800ms (fail) or ≥800ms (warn)
│   ├── generatePDF.js        # Puppeteer PDF renderer (page, site, compare)
│   ├── score.js              # Shared scoring and grading logic
│   ├── tiers.js              # Plan tier definitions and rate limit config
│   ├── gsc.js                # Google Search Console API helper (token refresh + searchAnalytics)
│   ├── webhooks.js           # HMAC-SHA256 signed webhook dispatcher
│   └── db.js                 # Knex database instance (null if DATABASE_URL not set)
└── output/                   # Generated PDFs (gitignored)
```

---

## Known Limitations

- JS-rendered SPAs will score poorly — static HTML only
- PageSpeed Insights free tier: ~400 req/day/IP. Set `PAGESPEED_API_KEY` to raise this
- Site crawl is capped at 50 pages; compare audit at 10 URLs (free tier)
- Site audit skips checks that make extra HTTP requests per page (PageSpeed, broken links, redirect chains, sitemap validation, robots.txt checks, og:image check, canonical chain) to keep crawl time manageable

---

## Dependencies

| Package | Purpose |
|---|---|
| `nuxt` | Full-stack Vue framework (replaces Express) |
| `nuxt-auth-utils` | Sealed cookie sessions + OAuth helpers |
| `@pinia/nuxt` | Pinia state management integration |
| `pinia` | Vue state management |
| `vue` | UI framework |
| `axios` | HTTP requests (audit fetcher) |
| `cheerio` | HTML parsing |
| `knex` | SQL query builder and migrations |
| `pg` | PostgreSQL client |
| `puppeteer` | Headless browser for PDF generation |
| `handlebars` | HTML templating for PDF reports |
| `stripe` | Payment processing |

---

## License

MIT
