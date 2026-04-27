# SignalGrade — Feature Backlog

Items 6–20 from the pre-monetization gap analysis. Implement after the critical launch items are complete.

---

## High Priority — Strong Differentiators

### 6. Historical Score Trend Charts on Dashboard
**Why:** Every top competitor (Ahrefs, Sitebulb, Semrush) shows score-over-time charts. A flat list of past reports doesn't answer "is my site improving?". This is the primary retention hook.
**How:** Add a line chart (Chart.js or uPlot — lightweight) to `templates/dashboard.hbs` grouping past reports by domain. The `reports` table already has `score`, `created_at`, and `url`, so no schema changes are needed. Group by hostname, render one line per tracked domain.

---

### 7. Scheduled / Recurring Audits
**Why:** Ahrefs's "Always-on Audit" is cited as their #1 differentiator. Recurring audits are the core mechanism for SaaS retention and justified subscription pricing. Without them, users have no reason to stay subscribed.
**How:** Add a `scheduled_audits` table (`id`, `user_id`, `url`, `frequency` enum `weekly|monthly`, `next_run_at`, `last_run_at`). Run a cron worker (node-cron or a separate process) that picks up due audits, calls the existing audit logic, saves results, and emails the PDF. Requires email integration (item 8 below).

---

### 8. Email Notifications (Transactional)
**Why:** No email system means no welcome emails, no scheduled report delivery, and no critical-issue alerts. Users have no reason to return between manual audits.
**How:** Integrate Resend (resend.com — simple REST API, generous free tier). Send:
- Welcome email on first sign-in
- Report-ready email when a scheduled audit completes (attach or link to PDF)
- Critical regression alert when a re-audit score drops >10 points vs previous
Store `RESEND_API_KEY` in `.env`. Create `utils/email.js` wrapping the Resend API. Keep templates simple — HTML string with the same dark-theme color tokens.

---

### 9. "Fix These First" Priority Callout in Results UI
**Why:** The PDF already has a `top7Fails` executive summary section but the web UI doesn't expose this. Competitors all have a prominent "fix these 5 things first" card. Users shouldn't have to scroll through 73 checks to find the highest-impact issues.
**How:** After `renderResults()` runs in `index.html`, insert a "Top Priorities" card above the category breakdown. Sort `results` by `(100 - normalizedScore)` descending, take the top 5 fails, render as a numbered callout card with the check name + score deficit. No server changes needed — pure client-side JS.

---

### 10. Change Detection Between Audits
**Why:** Users who re-run audits can't see what regressed or improved since last time. Sitebulb's audit comparison is cited as a key feature.
**How:** On `/dashboard`, add a "Compare" button that appears when ≥2 reports exist for the same domain. Clicking opens a `/compare?a=<id>&b=<id>` route that loads both reports' stored JSON, diffs them by check name, and renders new-issues / resolved-issues / score-delta. The `reports` table would need a `results_json` column to store the full check payload — currently only score/grade are stored. Add a migration for this column and populate it going forward.

---

## Medium Priority — Competitive Table-Stakes

### 11. Missing Technical Audit Checks (8 new checks)
**Why:** Semrush checks 140+ issues; Ahrefs 170+; Screaming Frog 300+. SignalGrade has 73. Each new check adds auditable surface area and improves the competitive story.
**Checks to add (each is a new file in `/audits/`):**
- `technicalCacheControl.js` — `Cache-Control` header presence + `max-age` value scoring
- `technicalCSP.js` — `Content-Security-Policy` header presence (OWASP recommended)
- `technicalPreconnect.js` — `<link rel="preconnect">` for Google Fonts / CDN origins
- `technicalRenderBlocking.js` — `<script>` tags in `<head>` without `async` or `defer`
- `technicalMinification.js` — heuristic: inline JS/CSS > 5KB without minification signals (source map refs, non-minified variable names)
- `technicalWebManifest.js` — `<link rel="manifest">` presence for PWA readiness
- `technicalCrawlDelay.js` — `Crawl-delay` directive in robots.txt (flags if throttled)
- `technicalXRobotsTag.js` — `X-Robots-Tag` HTTP header noindex/nofollow detection (complements existing meta robots check)
**Also:** Update `STEPS` array in `index.html` with 8 new entries, and update check counts in README and CLAUDE.md.

---

### 12. Competitor Comparison Mode (URL Comparison Reframe)
**Why:** Seobility and Semrush offer side-by-side competitor analysis. The current Multi-Location audit is labeled for "locations" but structurally supports any URLs. Reframing it opens a new use case without new server code.
**How:** Rename the mode toggle from "Multi" to "Compare" in the UI. Change the input label from "Location" to "URL" with an optional custom label field. Add a note "Enter your site + up to 9 competitor URLs." No server-side changes needed — `/multi-audit` already accepts arbitrary URLs. Update dashboard type badge from "Multi" to "Compare".

---

### 13. Embeddable Audit Widget for Agencies
**Why:** GEOReport.ai's white-label reporting is a key differentiator. Agency users want to embed a "Get your free SEO score" widget on their own sites. The existing PDF `logoUrl` branding is a start but not sufficient.
**How:** Create a `public/widget.js` that renders an `<iframe>` pointing to a new `/widget` route. The widget route renders a minimal version of the audit form + results using the existing `/audit` endpoint. Parameterize via `data-api-key` attribute on the script tag. API key validation gates widget usage to pro/agency tier users.

---

### 14. API Access and API Key Management
**Why:** Enterprise/developer users want programmatic access. Agencies want to integrate audit results into client dashboards. The existing `/audit` POST endpoint is already API-shaped — it just needs authentication, rate limiting, and docs.
**How:**
- Add `api_keys` table (`id`, `user_id`, `key_hash`, `label`, `created_at`, `last_used_at`)
- Add `/account` section for generating/revoking keys
- Accept `Authorization: Bearer <key>` header on `/api/v1/audit`, `/api/v1/crawl`
- Rate limit by key (pro: 100 req/day, agency: 1000 req/day)
- Add a `/docs` static page with endpoint reference

---

### 15. Sitemap XML Export from Site Crawl
**Why:** Several free tools offer sitemap generation as a lead magnet. After a site crawl, all discovered URLs are already in memory — generating a sitemap is a small addition.
**How:** After `/crawl` completes, add a "Export Sitemap XML" button to the Site Audit results section in `index.html`. On click, collect all `pages[].url` values from the SSE `done` event payload, format as XML (`<?xml version="1.0"?><urlset>…</urlset>`), and trigger a `Blob` download. Pure client-side — no server changes.

---

## Nice-to-Have / Future

### 16. JavaScript Rendering Support for SPAs
**Why:** Modern web apps built with React/Vue/Angular score poorly since their content is JS-rendered. Screaming Frog supports this. Puppeteer is already a dependency (used for PDFs) so the infrastructure exists.
**How:** Add a "JS Render" toggle in the audit input UI (disabled by default, adds ~5–15s per page). When enabled, fetch via `puppeteer.page.goto(url)` instead of axios, then pass `page.content()` to cheerio and audits as normal. Gate this feature to pro/agency tier users. Add `JS_RENDER_TIMEOUT=15000` env var.

---

### 17. Google Search Console Integration
**Why:** Semrush and Ahrefs surface real traffic/keyword data alongside technical audit results. GSC integration would show which pages are actually indexed vs which have technical issues — bridging the gap between "what's broken" and "what's affecting traffic."
**How:** Expand Google OAuth scope to include `https://www.googleapis.com/auth/webmasters.readonly`. After auth, call the GSC API to fetch index coverage and top queries for the audited domain. Display inline in the page audit results as a collapsible "Search Console Data" panel. Requires storing Google OAuth access/refresh tokens — add to `users` table via migration.

---

### 18. Webhook / Zapier Integration
**Why:** Power users want to pipe audit results into Slack, Notion, or Jira for team workflow. Common in B2B SaaS tools.
**How:** Add a `webhooks` table (`id`, `user_id`, `url`, `events[]`, `secret`). After each audit completion, POST JSON payload to registered webhook URLs. Sign payloads with HMAC-SHA256 using the webhook secret. Add webhook management UI in `/account`. Gate to pro/agency tier.

---

### 19. Team / Collaboration Features
**Why:** No multi-user team accounts means agencies can't share a workspace. A team share is typically a paid-tier upsell.
**How:** Add an `organizations` table with many-to-many `org_users` membership. Reports become org-scoped when created within an org context. Add shareable report URLs (time-limited signed tokens, e.g., `/report/share/<token>`) for unauthenticated viewing. Gate team workspaces to agency tier.

---

### 20. CSV / JSON Raw Data Export
**Why:** Developers and agencies often want raw audit data for their own analysis or to import into other tools. PDF is the only current export format.
**How:** Add two buttons to the page audit results footer: "Export JSON" (download the same JSON that `/audit` returns) and "Export CSV" (flatten the results array into `name,status,score,maxScore,message,recommendation` rows). Pure client-side — no server changes. For site audit, serialize the aggregated results from the SSE `done` event.

---

## Account Page Enhancements

### A1. Usage Summary
**Why:** Shows the user the value they're getting and sets context for upgrade prompts.
**How:** Add a "Usage" card to `/account` showing: audits run this month, total reports saved. Pull from a `COUNT(*)` query on the `reports` table filtered by `user_id` and the current month. No schema changes needed.

### A2. Delete Account
**Why:** Required in most jurisdictions (GDPR, CCPA). Trust signal — users are more willing to sign up if they know they can leave.
**How:** Add a "Danger Zone" card at the bottom of `/account` with a "Delete account" button. Clicking shows an inline "Are you sure? This deletes all your reports." confirmation. On confirm: `DELETE FROM reports WHERE user_id = ?`, then `DELETE FROM users WHERE id = ?`, then `clearUserSession(event)` + redirect to `/`. Gate behind a re-confirmation input (type "DELETE" to proceed) if desired.

### A3. Custom PDF Logo URL (Agency)
**Why:** Agency plan users want every PDF auto-branded with their logo without pasting the URL each time.
**How:** Add a `pdf_logo_url` column to the `users` table (migration required). Show an editable "Default PDF Logo" field in the Profile card (Agency plan only). Save via `PATCH /api/account/logo`. The audit route reads `user.pdf_logo_url` as a fallback when no `logoUrl` is provided in the audit request body.

### A4. Report Retention Notice
**Why:** Sets expectations — free users should know reports may be pruned in the future.
**How:** Add a small notice line in the Plan card: e.g., "Free plan: reports kept indefinitely (subject to change)." When a retention policy is implemented, update this copy.

---

## GEO Section — Future AI Search Visibility

### 21. Live AI Search Presence Check (requires AI API keys)
**Why:** Dedicated GEO tools like Otterly.ai and GEOReport.ai actually query ChatGPT/Perplexity/Gemini to see if they mention the site. SignalGrade's current GEO checks are static signals — they don't verify actual AI visibility.
**How:** Add optional env vars `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`. When set, add a new GEO check that sends queries like "Who is [brand name]?" and "What are the best [service] companies?" to each AI engine and checks if the audited domain is mentioned in responses. This is the core differentiator of GEOReport.ai and would be a significant moat.

### 22. /llms-full.txt Check
**Why:** A newer convention beyond `/llms.txt` (established by some LLM tooling projects) that provides more detailed site structure for AI crawlers.
**How:** Simple addition to `geoLlmsTxt.js` — after checking `/llms.txt`, also HEAD `/llms-full.txt` and factor its presence into the score. Low effort.
