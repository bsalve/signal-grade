# SearchGrade — Feature Backlog

Items remaining after the full 3-plan implementation cycle. Everything not listed here has been implemented.

---

## Deferred — Needs More Data / Infrastructure

### P1-C. Issue Grouping by Page Template (Site Audit)
**Why:** When 40 product pages all fail the same check, showing 40 rows is noise. Enterprise tools (Lumar, Sitebulb) group by template type.
**How:** After `aggregateResults()`, bucket pages by URL pattern (`/blog/`, `/product/`, `/category/`). Add a "By Template" toggle in the site audit UI that pivots the issue breakdown.

### P1-D. Public Benchmark Percentiles
**Why:** "Your score is 73" is meaningless without context. Needs enough audits in the DB first.
**How:** Pre-compute percentile buckets from `reports` table (refresh daily). Add "Top X% of sites audited" badge next to grade. Gate to aggregate stats — never expose raw user data.

---

## Deferred — Requires Additional API Keys

### P2-A. INP (Interaction to Next Paint)
**Why:** INP replaced FID as a Core Web Vitals metric in March 2024. Currently PSI returns it but it's not surfaced as its own check.
**How:** In `checkPageSpeed.js`, extract INP from PSI response and return as a fourth result. Score: Good <200ms (100), Needs Improvement <500ms (60), Poor ≥500ms (0).

### P6-A. Multi-Platform AI Presence
**Why:** `geoAIPresence.js` queries only Gemini (via grounding). Side-by-side across ChatGPT + Gemini + Perplexity would be unique at any price point.
**How:** Add optional `OPENAI_API_KEY` and `PERPLEXITY_API_KEY` env vars. When set, query each platform and return multi-column presence result. Skip in site crawl.

### P7-B. AI Executive Narrative in PDF
**Why:** The AI Executive Summary shows on the web UI (implemented). Injecting it into the PDF report would give agencies a ready-to-share document with context baked in.
**How:** Pass `aiSummary` from the DB into the Handlebars PDF template and render it above the stats row in `report.hbs`. Requires `GROQ_API_KEY`. Gate to Agency tier. Low effort — most of the AI work is done.

---

## Deferred — Architecture & Visualization

### P5-A. Site Architecture Visualization
**Why:** Tools like Screaming Frog and Sitebulb show an interactive link graph. SearchGrade collects the full crawl graph (`outLinks[]` per page) but never visualizes it.
**How:** After site crawl, render an interactive force-directed graph (D3 or Cytoscape.js) in the site audit results. Nodes = pages, edges = internal links. Color by status (red = has failures, green = all pass). Click node to highlight its inbound/outbound links. Very high complexity — separate implementation effort.

### P5-D. Rank Tracking
**Why:** Knowing a site's keyword positions gives the audit context. "You have weak title tags AND you rank #18 for your target term" is far more actionable.
**How:** Requires a paid SERP API (DataForSEO, Semrush API, or SerpAPI). Add a `rank_tracking` DB table, a keyword input on the audit page, and a positions panel on the dashboard. Gate to Agency tier.

---

## Deferred — Large / Separate Projects

### P6-C. Team / Workspace Collaboration
**Why:** Agencies managing multiple clients need shared workspaces.
**How:** `organizations` + `org_members` tables, org-scoped reports, team invite flow. Gate to Agency tier. Scope carefully — this is a significant feature.

### P7-A. Chrome Extension
**Why:** One-click "Audit this page" from any browser tab — major acquisition channel.
**How:** Manifest V3 extension. Popup pre-fills current tab URL, calls `/audit` with user's API key, shows grade + top 3 issues inline. Requires API key — drives Pro/Agency signups.

---

## Deferred — Minor / Nice-to-Have

### P7-E. Voice Search Optimization Check
**Why:** Makes the AEO "voice" angle explicit. Overlaps with existing checks but useful as a composite signal.
**How:** New `aeoVoiceSearch.js` — composite of speakable schema, short answer paragraphs <30 words, question headings, and local NAP schema. Reference existing checks rather than duplicating logic.
