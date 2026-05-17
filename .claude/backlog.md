# SearchGrade — Feature Backlog

Priority order: highest to lowest within each tier. Items marked **[existing]** were carried over from the previous backlog.

---

## Tier 0 — Critical Fixes (Reduce Usability of Existing Features)

*All T0 items have been implemented. See `features.md` for details.*

---

## Tier 1 — High Priority Product Gaps (Table Stakes for Competitors)

*T1-1 through T1-6, T1-10 through T1-13 have been implemented. See `features.md` for details.*
*T1-12 (Always-On Monitoring) implemented in `server/plugins/scheduler.ts` — noindex/SSL/broken-link alerts.*

*The following three items are blocked on a single external API key. They share the same DataForSEO client and should be implemented together once `DATAFORSEO_API_KEY` is available.*

### T1-7. Backlink Overview (via DataForSEO or Similar API)
**Problem:** Backlinks are the #1 off-page SEO signal and every major competitor surfaces them. SearchGrade covers everything on-page but has zero backlink data. Users must go to Ahrefs/Moz separately.
**Fix:** Integrate DataForSEO Backlink API (or SerpApi, or Moz API). Add a "Backlinks" tab to page audit results showing: total backlinks, referring domains, domain authority score, top 5 anchor texts, dofollow/nofollow ratio. Add a `[Technical] Backlink Profile` check that scores based on referring domain count + authority. Gate to Pro+. Add `DATAFORSEO_API_KEY` or equivalent to env vars.

### T1-8. Keyword Rank Tracking
**Problem:** Knowing you have a weak title tag is only half the story — knowing you rank #18 for your target keyword makes the fix urgent. Without rank data, audits lack business context.
**Fix (same as existing P5-D):** Integrate a SERP API. Add a keyword input on audit page ("What keyword are you targeting for this URL?"). Store in `reports` table. Show current rank + position history chart on saved reports. Add a dedicated Rank Tracker section in the dashboard for tracked keywords across domains. Gate to Pro+.
**Note:** This was already in the old backlog as P5-D — promoted to Tier 1 given competitive necessity.

### T1-9. SERP Feature Detection
**Problem:** SearchGrade tells you how to *optimize* for featured snippets and PAA, but doesn't tell you whether you're *currently appearing* in them. Ahrefs and SEMrush both show this.
**Fix:** Use a SERP API (DataForSEO or SerpApi) to detect whether the audited URL currently appears in: Featured Snippet, People Also Ask, Knowledge Panel, Image Pack, Video Carousel, Local Pack, Site Links. Add a "SERP Features" panel in page audit results. Score contributions: appearing in featured snippet = pass for `aeoFeaturedSnippetFormat`, etc.

---

## Tier 2 — Important Features (Strong Differentiators)

*T2-1 through T2-9, T2-11, T2-12, T2-14, T2-15, T2-17 have been implemented. See `features.md` for details.*

### T2-10. White-Label Custom Domain for Shared Reports
**Problem:** Agency users share reports via `searchgrade.com/report/share/[token]` — the SearchGrade branding is visible. Agencies want to present reports under their own domain.
**Fix:** Add a "Custom Report Domain" field to the Agency account page. Store in `users.custom_domain`. On the public share route, check if the request origin matches a custom domain and apply white-label branding (brand color, logo, no SearchGrade wordmark). Requires DNS CNAME instruction for the agency.
**[DEFERRED → T5]** This is a DNS/infrastructure task — wildcard proxy routing, CNAME verification, and per-domain SSL provisioning are ops work, not a feature sprint. Moved to T5 alongside R2 and Redis work. The existing white-label branding (colors, logo, hide wordmark) already covers the core agency need.

### T2-11. Crawl Diff Improvements — Issue Delta Table
**Problem:** The crawl diff view (`/report/crawl-diff`) shows two crawls side-by-side but doesn't explicitly surface what got worse vs. better. It's a raw comparison, not a curated delta.
**Fix:** In `crawl-diff.vue`, add a "Regressions" and "Improvements" section at the top — checks that changed from pass→fail (regressions) or fail→pass (improvements), with page counts. Mirrors the existing `compare.vue` delta table pattern.

### T2-12. In-App Documentation / Help Tooltips
**Problem:** Check names like `[GEO] Entity Clarity` or `[AEO] Speakable Schema` are opaque to users unfamiliar with these concepts. Tools like Ahrefs show a "?" icon next to every issue with a brief explanation.
**Fix:** Add a `docs` field to each audit module's return object: one-sentence explanation of *why* the check matters. In the audit results UI, add a small `?` tooltip trigger next to each check name that shows this text on hover. This does not require external links.

### T2-13. Content Gap Analysis (Semantic Topics)
**Problem:** Surfer SEO, Clearscope, and MarketMuse all identify what semantic topics your page is missing compared to top-ranking pages. SearchGrade has basic keyword density but no gap analysis.
**Fix:** New `content-gap.post.ts` API route. Given a URL + target keyword, use a SERP API to get top 5 ranking pages, fetch their `<h1>`/`<h2>`/body text, extract top NLP entities/topics via Groq, compare against the audited page. Return a "Coverage Score" (0–10) and list of missing topics. Add as a new panel in page audit results (Pro+). Requires `SERP_API_KEY`.
**[DEFERRED]** Blocked on `SERP_API_KEY` (DataForSEO or SerpApi). This is the same external API dependency as T1-7, T1-8, and T1-9. Implement all four together as a dedicated "SERP API integration sprint" once the key is available.

### T2-16. AI Citation Tracking
**Problem:** Otterly AI and Profound detect when your content is cited as a *source* in AI answers — even without the brand being named. This is more valuable than just checking if the brand is mentioned. SearchGrade currently only checks for brand name mentions.
**Fix:** Extend the AI Visibility scanner to extract citation URLs from AI responses (ChatGPT and Perplexity return source URLs in their API responses). Check whether any of those URLs are on the audited domain. Add a "Cited as Source" metric to the AI Visibility score and per-query breakdown. Store citation URLs in `ai_visibility_scans` as a new `citation_url` column.
**[DEFERRED]** Hard dependency on T2-15. Citation URL extraction requires the OpenAI/Perplexity API integrations that T2-15 adds. Implement immediately after T2-15 ships as a follow-on task.

### T2-18. Domain Authority Score Integration
**Problem:** Moz's DA and Ahrefs' DR are industry-standard metrics that every SEO references. SearchGrade has no authority scoring at all — users must go elsewhere to get this number.
**Fix:** Add `MOZAPI_KEY` or `DATAFORSEO_API_KEY` support. When present, fetch Domain Authority (Moz) or Domain Rating (Ahrefs-equivalent via DataForSEO) for the audited URL and show it in the page audit results header alongside the grade. Add a `[Technical] Domain Authority` check that scores based on the DA/DR value. Not required for core functionality — degrade gracefully if key is absent.
**[DEFERRED]** Same external API dependency blocker as T1-7, T1-8, T1-9. All four belong in the same "DataForSEO/Moz API integration sprint." Do not implement in isolation.

---

## Tier 3 — Completed

*T3-1 through T3-12 have all been implemented. See `features.md` for details.*

---

## Tier 4 — Advanced Analytics & Visualization

### T4-1. Site Architecture Link Graph Visualization
**Problem (existing P5-A):** The full crawl graph (outLinks per page) is collected but never visualized. Screaming Frog and Sitebulb are famous for this view — it immediately reveals orphaned clusters and link depth problems.
**Fix:** After site crawl, render an interactive force-directed graph using D3.js or Cytoscape.js. Nodes = pages, edges = internal links. Color by status (red = failures, yellow = warnings, green = all pass). Click node to highlight inbound/outbound links and show metrics in a side panel. Very high complexity — separate sprint.

### T4-2. Public Benchmark Percentiles
**Problem (existing P1-D):** "Score 73/100" means nothing without context. Ahrefs shows "Your site is healthier than 43% of sites we've audited."
**Fix:** Pre-compute score percentile buckets from the `reports` table daily (cron). Add "Top X% of all sites audited" label next to the grade. Only show when the bucket has statistical significance (>1,000 samples). Never expose raw user data.

### T4-3. Issue Grouping by Page Template / URL Pattern
**Problem (existing P1-C):** When 40 product pages fail the same check, showing 40 identical rows in site audit results is noise. Screaming Frog, Lumar, and Sitebulb all group by template.
**Fix:** After `aggregateResults()`, cluster pages by URL pattern (`/blog/`, `/product/`, `/category/`, etc.) using prefix matching. Add a "By Template" toggle in site audit results. Shows: template name, pages count, most common issues. Drilldown shows individual pages.

### T4-4. Score History Export
**Problem:** There's no way to export score trend data as CSV or JSON for use in spreadsheets or custom BI dashboards.
**Fix:** Add an "Export trend data" button on each domain's score trend card on the dashboard. Exports CSV with columns: date, overall_score, technical_score, content_score, aeo_score, geo_score, grade.

### T4-5. Custom Score Weighting
**Problem:** A local restaurant doesn't care about GEO signals as much as a tech company does. An e-commerce store cares more about Technical than Content tone. Fixed equal weighting penalizes sites unfairly for irrelevant categories.
**Fix:** Add a "Score Weights" panel in the audit customize options (Pro+): sliders for Technical / Content / AEO / GEO weight (0–100%, must total 100%). These weights are applied at scoring time in `calcTotalScore()`. Weights stored in session and optionally saved to user profile.

### T4-6. Custom Check Rules
**Problem:** Enterprise SEO teams have specific standards — "our title tags must be 45–55 chars, not 50–60." Screaming Frog allows custom extraction + custom scoring rules.
**Fix:** Add a "Custom Rules" panel to account settings (Agency). Allow users to define overrides: check name → custom pass/fail threshold. Store as JSON in `users.custom_rules`. Apply overrides in `auditRunner.js` before returning results.

### T4-7. Looker Studio / Google Data Studio Integration
**Problem:** Sitebulb feeds crawl data into Looker Studio for live custom dashboards. Agencies who already use Looker Studio for client reporting want SEO audit data there too.
**Fix:** Add a "Looker Studio Export" endpoint that returns audit trend data in the format Looker Studio's Community Connectors expect. Alternatively, auto-push to a Google Sheet (Sheets API, OAuth) after each audit so clients can build their own Looker dashboards. Gate to Agency.

### T4-8. Per-Check Historical Trend
**Problem:** Seeing that overall score went from 65 → 72 is good, but which specific checks improved? There's no way to know if the title tag fix or the schema fix drove the change.
**Fix:** On saved report compare view, add a "Check History" table showing each check's score across all saved reports for that domain. Column per audit, row per check. Color-code cells by score. This is a pivot view of existing `results_json` data.

---

## Tier 5 — Platform & Infrastructure

### T5-1. Team / Workspace Collaboration
**Problem (existing P6-C):** Agencies managing multiple clients need shared workspaces — one team member shouldn't need to re-login to see another's reports.
**Fix:** Add `organizations` + `org_members` tables. Org owner invites members by email → sends invite link. Reports, API keys, scheduled audits, and webhook configs are org-scoped. Org billing: one Stripe subscription per org. Gate to Agency tier. Large scope — plan separately.

### T5-2. Chrome Extension — "Audit This Page"
**Problem (existing P7-A):** One-click page audit from any browser tab is a major acquisition channel. Ahrefs SEO Toolbar and Moz Bar are both widely used.
**Fix:** Manifest V3 extension. Popup shows current tab URL pre-filled, calls `/audit` with user's API key (stored in extension storage), shows grade + top 5 issues inline. Link to full report on searchgrade.com. Drives Pro/Agency signups (API key required). Medium complexity, high distribution value.

### T5-3. Developer Portal — API Docs + Sandbox
**Problem:** API documentation lives in a static `docs.vue` page. There's no interactive sandbox, no code generation, no OpenAPI spec download — just text.
**Fix:** Generate an OpenAPI 3.0 spec from the existing API routes. Embed Swagger UI or Redoc on `/docs`. Add "Try it" buttons with the user's real API key pre-filled if logged in. Publish the spec as `/openapi.json` for third-party integrations.

### T5-4. WordPress / Shopify Plugin
**Problem:** A large % of the addressable market uses WordPress or Shopify. An official plugin/app drives organic installs without ad spend.
**Fix:** WordPress plugin: sidebar widget showing site score + top issues, auto-runs weekly audit via API key, shows recommendations inline in the WP admin. Shopify app: similar but in Shopify admin dashboard. Both call the SearchGrade API. High complexity, high distribution value. Separate project.

### T5-5. Persistent Rate Limiter (Redis/DB-backed)
**Problem:** The in-memory rate limiter in `01.rateLimit.ts` resets on server restart and won't work correctly with multiple server instances (e.g., load-balanced deployments).
**Fix:** Replace the in-memory `Map` with a Redis-backed counter (`REDIS_URL` env var, fallback to in-memory for dev). Use `ioredis` + sliding window algorithm. This unblocks horizontal scaling.

### T5-5b. Log File Analysis
**Problem:** Screaming Frog's log file analysis is a unique and powerful feature — import server access logs to see actual Googlebot crawl frequency and priority vs. what your spider finds. No other cloud SaaS tool offers this. Reveals crawl budget waste and high-priority pages Googlebot never visits.
**Fix:** Add a log file upload feature (Agency+). Parse Apache/Nginx/Cloudflare access logs for Googlebot user-agent entries. Build a report: most crawled URLs, least crawled, crawl frequency, Googlebot vs. other bots. Cross-reference against site audit results to find: pages Googlebot crawls a lot but are failing checks, or pages passing checks but never crawled. Store parsed log data in a new `crawl_log_analysis` table.

### T5-5c. Custom Data Extraction (XPath / CSS / Regex)
**Problem:** Screaming Frog's custom extraction lets power users scrape any element from any page during a crawl — prices, stock levels, custom meta fields, specific text patterns. This makes it a universal data-collection tool, not just an SEO auditor. Huge for enterprise and technical SEO teams.
**Fix:** Add a "Custom Extractions" panel to site audit settings (Agency+). Users define up to 10 custom extractors: name, selector type (CSS/XPath/Regex), selector value. During crawl, apply each extractor to every page and include results in `results_json`. Show extracted data per URL in site audit results as additional columns. Export with XLSX.

### T5-6. Cloudflare R2 PDF Storage — Complete the Integration
**Problem:** `utils/r2.js` exists but R2 upload is optional and partially wired. PDFs are currently served from `/output/` on the local filesystem, which doesn't survive server restarts or serverless deployments.
**Fix:** Make R2 upload mandatory when `R2_*` env vars are present. After PDF generation, upload to R2 and store the R2 key in `reports.r2_key`. When serving a PDF download, redirect to a pre-signed R2 URL. Delete local PDF after upload. Gate behind env var presence so dev still uses local files.

---

## Tier 6 — Nice to Have / Moonshots

### T6-1. AI Executive Narrative in PDF
**Problem (existing P7-B):** The AI Executive Summary shows on the web UI but isn't in the PDF, even though it's already generated and stored.
**Fix:** Pass `aiSummary` from the DB into the `report.hbs` Handlebars template and render it as a styled section above the stats table. Gate to Agency tier. Low effort — most of the AI work is already done.

### T6-2. INP (Interaction to Next Paint) Metric
**Problem (existing P2-A):** INP replaced FID as a Core Web Vital in March 2024. PSI returns it but it's not surfaced as its own check.
**Fix:** In `checkPageSpeed.js`, extract `INP` from the PSI response and return as a dedicated result. Score: Good <200ms = 100, Needs Improvement <500ms = 60, Poor ≥500ms = 0. Show in CWV history chart.

### T6-3. Voice Search Optimization Composite Check
**Problem (existing P7-E):** The AEO category covers voice signals (speakable, concise answers, question headings) but there's no single "Voice Search Score" that aggregates them.
**Fix:** New `aeoVoiceSearch.js` — composite check that references existing `aeoSpeakable.js`, `aeoConciseAnswers.js`, `aeoQuestionHeadings.js`, and NAP schema. Returns a weighted composite 0–100. Show as a callout card in AEO results.

### T6-4. Email On-Demand Report Delivery
**Problem:** Users can schedule recurring audits, but there's no way to email a specific saved report to a client without downloading and manually attaching it.
**Fix:** "Email this report" button on saved report viewer. Opens a modal: enter up to 3 email addresses, optional message, and send. Attaches PDF (from R2 or local output). Uses existing Resend integration. Gate to Pro+ (to prevent abuse).

### T6-5. Issue Tracker Integration (Jira / Linear / GitHub Issues)
**Problem:** Development teams who act on SEO issues want to push failing checks directly into their existing task management workflow, not manage a separate to-do list.
**Fix:** In report/audit results, add "Export to Jira / Linear / GitHub" button per check (or bulk for selected). OAuth connection to each platform stored in `users` table. Creates a ticket with: check name, score, recommendation, and link to the report. Gate to Agency.

### T6-6. Mobile App (iOS / Android)
**Problem:** Checking site health on mobile is clunky. A native app would enable push notifications for score drops, quick audits, and client-facing dashboards.
**Fix:** React Native / Expo app. Core features: run page audit, view report history, receive push notifications for scheduled audit alerts and score drops. Calls SearchGrade API. Long-term project — consider after Chrome extension ships.

### T6-7. White-Label Agency Portal
**Problem:** White-label currently means branded share links. Full white-labeling would mean agencies can give clients a login to a co-branded portal showing only their reports.
**Fix:** Agency subdomain portal (`client.youragency.com`): client logs in via magic link (no Google OAuth), sees only reports the agency has shared with them, branded with agency colors/logo. Requires org feature (T5-1) as prerequisite.

### T6-8. Accessibility Audit Expansion (WCAG 2.2)
**Problem:** `technicalAccessibility.js` exists but likely covers basics only. Accessibility is increasingly an SEO factor (Core Web Vitals overlaps, Google uses a11y signals). WCAG 2.2 compliance is also a legal requirement in many jurisdictions.
**Fix:** Expand `technicalAccessibility.js` to cover: color contrast ratios (simulate, warn on likely failures), keyboard navigation indicators (`focus-visible`), ARIA landmark usage, form label associations, skip-to-content link. Score WCAG 2.2 Level AA compliance percentage. Show as a dedicated Accessibility section in Technical results.

---

## Carried Over — Deferred Items (Still Valid)

### C1. Issue Grouping by Page Template (Site Audit)
*(formerly P1-C)* — See T4-3 above (promoted and expanded).

### C2. Public Benchmark Percentiles
*(formerly P1-D)* — See T4-2 above (promoted and expanded).

### C3. INP Metric
*(formerly P2-A)* — See T6-2 above.

### C4. Multi-Platform AI Presence
*(formerly P6-A)* — See T2-15 above (promoted to Tier 2).

### C5. AI Executive Narrative in PDF
*(formerly P7-B)* — See T6-1 above.

### C6. Site Architecture Visualization
*(formerly P5-A)* — See T4-1 above.

### C7. Rank Tracking
*(formerly P5-D)* — See T1-8 above (promoted to Tier 1).

### C8. Team / Workspace Collaboration
*(formerly P6-C)* — See T5-1 above.

### C9. Chrome Extension
*(formerly P7-A)* — See T5-2 above.

### C10. Voice Search Optimization Check
*(formerly P7-E)* — See T6-3 above.
