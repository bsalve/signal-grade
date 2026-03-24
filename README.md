# Local SEO Audit Tool

A Node.js CLI tool that audits a website URL against a suite of local SEO best-practice checks. It outputs a human-readable report to `stderr` and a structured JSON result to `stdout`, including a total score out of 100 and an A–F letter grade.

---

## Requirements

- Node.js >= 16

---

## Installation

```bash
git clone https://github.com/your-username/local-seo-audit-tool.git
cd local-seo-audit-tool
npm install
```

---

## Usage

```bash
node index.js <url>
```

**Examples:**

```bash
# View the full report in the terminal
node index.js https://example.com

# Save the JSON output to a file (report still prints to terminal)
node index.js https://example.com > result.json

# Pipe the JSON into jq silently
node index.js https://example.com 2>/dev/null | jq '.grade'
```

---

## Output

### Terminal (stderr) — human-readable report

```
──────────────────────────────────────────────────────
 LOCAL SEO AUDIT REPORT
──────────────────────────────────────────────────────

[✓] SSL / HTTPS [100/100]
    HTTPS is active. Certificate is valid for 61 more day(s).
    Details: Issued to: example.com | Expires: May 24 23:59:59 2026 GMT

[⚠] Title Tag
    Title tag is too short (14 chars). Aim for 30–60 characters.
    ...

──────────────────────────────────────────────────────
 GRADE: B   SCORE: 83/100
 B (83/100) — Good — a few improvements would push this site to the top tier.
 6 passed · 2 warnings · 1 failed
──────────────────────────────────────────────────────
```

### stdout — JSON

```json
{
  "url": "https://example.com",
  "auditedAt": "2026-03-24T05:19:51.056Z",
  "grade": "B",
  "totalScore": 83,
  "summary": "B (83/100) — Good — a few improvements would push this site to the top tier.",
  "results": [
    {
      "name": "SSL / HTTPS",
      "status": "pass",
      "score": 100,
      "normalizedScore": 100,
      "message": "HTTPS is active. Certificate is valid for 61 more day(s).",
      "details": "Issued to: example.com | Expires: May 24 23:59:59 2026 GMT",
      "recommendation": null
    }
  ]
}
```

---

## Grading Scale

| Score | Grade | Meaning |
|---|---|---|
| 90–100 | A | Excellent |
| 80–89 | B | Good |
| 70–79 | C | Average |
| 60–69 | D | Poor |
| 0–59 | F | Critical |

The total score is the arithmetic mean of all individual normalized scores (each scaled to 0–100).

---

## Audit Modules

All modules live in `/audits`. They are loaded automatically — no changes to `index.js` are needed when adding a new module.

| File | Check | Max Score |
|---|---|---|
| `checkSSL.js` | HTTPS active, certificate valid, days until expiry | 100 |
| `checkMetaTags.js` | Title tag (30–60 chars) + meta description (70–160 chars) | 20 (normalized to 100) |
| `checkPageSpeed.js` | Google PageSpeed Insights mobile performance score | 100 |
| `checkPageSpeed.js` *(2nd result)* | Mobile friendliness via Lighthouse SEO audits | 100 |
| `checkNAP.js` | Phone number and street address present in page text | 100 |
| `checkCrawlability.js` | `/robots.txt` and `/sitemap.xml` exist and have valid content | 100 |
| `titleTag.js` | Title tag presence and length | pass/warn/fail |
| `metaDescription.js` | Meta description presence and length | pass/warn/fail |
| `headings.js` | Exactly one H1 tag present | pass/warn/fail |
| `schema.js` | JSON-LD structured data, LocalBusiness schema detection | pass/warn/fail |

> **Note:** `checkMetaTags.js`, `titleTag.js`, and `metaDescription.js` overlap intentionally — `checkMetaTags` is a self-contained scored module, while `titleTag` and `metaDescription` are the original lightweight checks loaded from the audits folder.

---

## Adding a New Audit

1. Create `/audits/yourCheck.js`
2. Export an `async function($ , html, url)` that returns a result object (or an array of result objects):

```js
module.exports = async function myCheck($, html, url) {
  return {
    name: 'My Check',       // Display name
    status: 'pass',         // 'pass' | 'warn' | 'fail'
    score: 95,              // 0–100 (omit if not applicable)
    maxScore: 100,          // Only needed if score is not on a 0–100 scale
    message: 'All good.',   // One-line summary
    details: '...',         // Optional extra context
    recommendation: '...',  // Only needed for warn/fail
  };
};
```

3. That's it — `index.js` auto-discovers the file via `fs.readdirSync`.

---

## Project Structure

```
local-seo-audit-tool/
├── index.js                  # Entry point — loads audits, runs them, outputs report + JSON
├── package.json
├── audits/
│   ├── checkCrawlability.js  # robots.txt + sitemap.xml
│   ├── checkMetaTags.js      # Title + meta description (scored, self-fetching)
│   ├── checkNAP.js           # Phone + address regex detection
│   ├── checkPageSpeed.js     # PageSpeed Insights performance + mobile friendliness
│   ├── checkSSL.js           # HTTPS + certificate validity
│   ├── headings.js           # H1 count
│   ├── metaDescription.js    # Meta description length
│   ├── schema.js             # JSON-LD / LocalBusiness schema
│   └── titleTag.js           # Title tag length
└── utils/
    ├── fetcher.js            # axios + cheerio page fetcher
    └── reporter.js           # (legacy) human-readable console printer
```

---

## Dependencies

| Package | Purpose |
|---|---|
| `axios` | HTTP requests for fetching pages and calling external APIs |
| `cheerio` | jQuery-style HTML parsing for DOM-based checks |

The PageSpeed Insights check uses the free Google PageSpeed Insights API (no key required for low-volume use). If you hit rate limits, set the `PAGESPEED_API_KEY` environment variable.

---

## License

MIT
