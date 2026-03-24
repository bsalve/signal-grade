# Claude Project Memory — Local SEO Audit Tool

Read this file at the start of every session. Keep it updated as the project evolves.

---

## What This Project Is

A Node.js CLI tool that accepts a website URL and runs a suite of local SEO checks against it. It outputs:
- A human-readable report to **stderr**
- A structured JSON result to **stdout** (safe to pipe/redirect)

The JSON includes a total score (0–100), an A–F letter grade, and an array of individual audit results.

---

## Project Layout

```
local-seo-audit-tool/
├── index.js                  # Entry point
├── package.json              # Dependencies: axios, cheerio
├── README.md                 # Public-facing documentation
├── .claude/
│   └── CLAUDE.md             # This file — Claude's session memory
├── audits/                   # One file per audit check (auto-loaded)
│   ├── checkCrawlability.js
│   ├── checkMetaTags.js
│   ├── checkNAP.js
│   ├── checkPageSpeed.js
│   ├── checkSSL.js
│   ├── headings.js
│   ├── metaDescription.js
│   ├── schema.js
│   └── titleTag.js
└── utils/
    ├── fetcher.js            # Shared axios+cheerio page fetcher
    └── reporter.js           # Legacy console printer (mostly superseded by index.js)
```

---

## How index.js Works

1. Uses `fs.readdirSync('./audits')` to auto-discover all `.js` files — **no manual imports needed** when adding a new audit module.
2. Calls `fetchPage(url)` once to get `$` (cheerio) and `html`.
3. Runs all audit functions in parallel via `Promise.all`, passing `($, html, url)` to each.
4. Flattens results with `.flat()` — audits may return a single object or an array.
5. Normalizes every result to 0–100 via `normalizeScore()`.
6. Averages all normalized scores → `totalScore`.
7. Assigns a letter grade from `letterGrade(score)`.
8. Writes human report to `stderr`, JSON to `stdout`.

---

## Audit Module Interface

Each audit exports a single `async function($, html, url)` and returns:

```js
{
  name: string,           // Display name shown in report
  status: 'pass' | 'warn' | 'fail',
  score: number,          // 0–N (optional — omit for pass/warn/fail-only audits)
  maxScore: number,       // Only if score is NOT on a 0–100 scale (e.g. checkMetaTags uses 20)
  message: string,        // One-line human summary
  details: string,        // Optional context (shown under message)
  recommendation: string, // Only for warn/fail results
}
```

Modules may also return an **array** of result objects (e.g. `checkPageSpeed` returns `[pageSpeedResult, mobileResult]`).

---

## Score Normalization

`normalizeScore(result)` in `index.js`:
- If `result.score` is defined: `Math.round((score / (maxScore ?? 100)) * 100)`
- If `result.score` is undefined: `pass=100`, `warn=50`, `fail=0`

This handles the `checkMetaTags` edge case (scored out of 20, carries `maxScore: 20`).

---

## Grading

```
90–100 → A  Excellent
80–89  → B  Good
70–79  → C  Average
60–69  → D  Poor
0–59   → F  Critical
```

---

## Audit Module Details

### `checkSSL.js`
- Uses Node's built-in `tls` module (no axios) to open a raw TLS socket.
- Checks: protocol is HTTPS, cert is trusted, cert is not expired, days until expiry.
- Score: 0 / 10 / 20 / 70 / 100 depending on severity.
- Returns a single result object.

### `checkMetaTags.js`
- Fetches the URL independently via axios + cheerio (self-contained).
- Checks title (30–60 chars, 10 pts) and meta description (70–160 chars, 10 pts).
- Returns `score` out of 20 with `maxScore: 20` — normalized to 100 by the aggregator.
- Returns a single result object.

### `checkPageSpeed.js`
- Calls Google PageSpeed Insights API (`strategy: mobile`, `category: ['performance', 'seo']`) — **one request, two results**.
- Result 1 — Page Speed: PSI performance score (0–100), Core Web Vitals in `details` (LCP, TBT, CLS).
- Result 2 — Mobile Friendliness: checks 4 Lighthouse SEO audits (`viewport`, `font-size`, `tap-targets`, `content-width`), each worth 25 pts.
- Returns an **array** of two result objects.
- API is free/keyless for low volume. Rate-limit error recommends setting `PAGESPEED_API_KEY` env var (the param slot is ready in the code).
- Timeout: 30 seconds (PSI is slow).

### `checkNAP.js`
- Fetches the URL independently via axios + cheerio (self-contained).
- Phone: 3 regex patterns covering NA format, international E.164, and `tel:` href.
- Address: regex covering street number + suffix, suite/unit lines, PO Boxes.
- Score: 50 pts phone + 50 pts address = 100 total.
- Returns a single result object.

### `checkCrawlability.js`
- Probes `{domain}/robots.txt` and `{domain}/sitemap.xml` in parallel via axios.
- Validates content (not just HTTP status): robots.txt must contain `User-agent:`, sitemap must contain `<urlset` or `<sitemapindex`.
- Present but invalid content → half points.
- Score: robots 40 pts + sitemap 60 pts = 100 total.
- Returns a single result object.

### `titleTag.js` / `metaDescription.js` / `headings.js` / `schema.js`
- Original lightweight audits. Synchronous. Use the `$` passed in from the shared fetch.
- No `score` field — normalized via `statusToScore()` (pass=100, warn=50, fail=0).
- `titleTag` and `metaDescription` overlap with `checkMetaTags` — this is intentional (they provide redundant signal in the report).

---

## Output Format (stdout JSON)

```json
{
  "url": "https://example.com/",
  "auditedAt": "2026-03-24T05:19:51.056Z",
  "grade": "D",
  "totalScore": 68,
  "summary": "D (68/100) — Poor ...",
  "results": [
    {
      "name": "...",
      "status": "pass|warn|fail",
      "score": 100,
      "maxScore": null,
      "normalizedScore": 100,
      "message": "...",
      "details": "...",
      "recommendation": "..."
    }
  ]
}
```

---

## Known Issues / Design Notes

- **Duplicate title/description checks**: `titleTag.js`, `metaDescription.js`, AND `checkMetaTags.js` all check the same fields. This inflates the score slightly for sites with good meta tags. Consider removing the original two once `checkMetaTags` is proven stable.
- **`reporter.js` is largely unused**: `index.js` has its own `printHumanReport()` function that writes to stderr. `reporter.js` is kept for backward compatibility but is no longer called by `index.js`.
- **PSI rate limits**: The free tier allows ~400 queries/day/IP. Running the tool repeatedly in quick succession will hit 429 errors on the PageSpeed checks.
- **Regex NAP detection**: Cannot detect phone numbers or addresses inside images, maps, or JavaScript-rendered content. Schema.org markup is a better signal for those cases.
- **Audit load order**: `fs.readdirSync` returns files in filesystem order (typically alphabetical on most OSes). The report order reflects this — it is not currently sorted by importance.

---

## How to Add a New Audit

1. Create `/audits/checkSomething.js`
2. Export `async function($, html, url)` returning a result object or array
3. No other changes needed — `index.js` auto-discovers it

---

## Dependencies

- `axios` — HTTP requests
- `cheerio` — HTML parsing
- Node built-ins used: `fs`, `path`, `tls`, `https`

---

## Live Test Run (2026-03-24) — evolutiondata.ca

Results from first real run against `https://evolutiondata.ca/`:
- Crawlability: PASS (robots.txt + sitemap.xml both valid)
- Meta Tags: WARN (title only 14 chars — "Evolution Data")
- NAP: PASS (phone +1 (859) 254-6589 and address 420 Bronte St detected)
- PageSpeed: FAIL (rate-limited — no API key set)
- Mobile Friendliness: FAIL (rate-limited — cascading from PageSpeed)
- SSL: PASS (cert valid 61 days, expires May 24 2026)
- H1: PASS ("IoT Solutions Simplified")
- Meta Description: PASS (122 chars)
- Schema: WARN (structured data present but type is "Unknown" — not LocalBusiness)
- Title Tag: WARN (14 chars — too short)
- **Final grade: D (68/100)**

The PSI rate-limit failure dragged the score significantly. With a PAGESPEED_API_KEY set the score would be materially different.
