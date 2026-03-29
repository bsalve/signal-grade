# Claude Project Memory — Local SEO Audit Tool

Read this file at the start of every session.

---

## What This Project Is

A Node.js tool with two modes:
- **CLI** (`node index.js <url>`): runs audits, prints human report to stderr, JSON to stdout, saves PDF to `/output`
- **Web server** (`npm start` → `node server.js`): Express on port 3000, auto-opens browser, dark UI at `public/index.html`

---

## Project Layout

```
index.js          # CLI entry — auto-loads audits, scores, outputs report + JSON + PDF
server.js         # Express server — GET /, POST /audit, GET /download, static /output
audits/           # One file per check (auto-discovered via readdirSync)
public/
  index.html      # Single-page dark UI (Space Mono, #0b0c0e bg, #4d9fff accent)
utils/
  fetcher.js      # axios + cheerio page fetcher
  score.js        # Shared scoring logic (normalizeScore, calcTotalScore, letterGrade, etc.)
  generatePDF.js  # Handlebars + Puppeteer → /output/seo-report-[domain]-[date].pdf
templates/
  report.hbs      # Handlebars HTML template for the PDF (dark theme, matches web UI)
output/           # Generated PDFs (gitignored)
```

## Audit Module Interface

Each audit exports `async function($, html, url)` returning:
`{ name, status, score?, maxScore?, message, details?, recommendation? }`
May return an array. Auto-discovered — no changes to `index.js` needed.

## Scoring (`utils/score.js`)

Scoring logic is shared between `index.js` and `server.js` via `utils/score.js`:
- If `score` present: `Math.round((score / (maxScore ?? 100)) * 100)`
- If no `score`: pass=100, warn=50, fail=0
- `totalScore` = arithmetic mean of all normalized scores
- Grades: 90→A, 80→B, 70→C, 60→D, <60→F

## Web UI Design Tokens (`public/index.html`)

```css
--bg: #0b0c0e      /* page background */
--bg2: #111214     /* card/block background */
--border: #1e2025  /* borders */
--dim2: #2a2d35    /* darker accents */
--text: #e4e6ea    /* main text */
--muted: #8892a4   /* secondary text */
--accent: #4d9fff  /* blue — links, highlights, active states */
--warn: #ffb800    /* amber — warnings */
--fail: #ff4455    /* red — failures */
--pass: #34d399    /* green — passes and A-grade scores ONLY */
```

Font: Space Mono (Google Fonts). The `run` button uses `--accent` background on hover (`#76baff`), NOT green.

## PDF Generation (`utils/generatePDF.js`)

- Reads `templates/report.hbs` **fresh on every call** (no server restart needed after template edits)
- Compiles with Handlebars; helpers: `eq`, `isDefined`
- Adds `meterColor`, `passCount`, `warnCount`, `failCount` to template data
- Footer: "Local SEO Audit Tool · date · Page N of M"
- Output filename: `seo-report-[hostname]-[YYYY-MM-DD].pdf`
- Puppeteer launch args required for background rendering on Windows:
  `--force-color-profile=srgb`, `--no-sandbox`, `--disable-setuid-sandbox`, `--run-all-compositor-stages-before-draw`
- Uses `page.goto('file:///abs/path/to/tmp.html')` (NOT `page.setContent`) — this is required for backgrounds to render
- Uses `page.emulateMediaType('screen')` + `printBackground: true`
- Writes HTML to a temp file (`_tmp_report.html`) and deletes it after PDF is saved

## PDF Template (`templates/report.hbs`)

Dark theme matching the web UI exactly. Color tokens are hardcoded (no CSS variables — Puppeteer resolves these fine, but keep them explicit for clarity):
- Background: `#0b0c0e`, card bg: `#111214`, borders: `#1e2025`
- Each result row has a colored left border (`2px solid`) based on status: green/amber/red
- Score block has a `3px solid #4d9fff` top border
- `@page { size: A4; margin: 0; }` — page margins are set via Puppeteer's `margin` option instead

## ⚠ PDF Performance Rule — Do Not Regress

**Never use these CSS properties in `report.hbs` — they cause scroll lag in PDF viewers:**
- `box-shadow` → use `border: 1px solid #1e2025` instead
- `opacity` on overlapping elements → use pre-mixed solid colours
- `transition` or `animation` → remove entirely

## ⚠ Color Separation Rule — Do Not Regress

`--accent` (#4d9fff blue) and `--pass` (#34d399 green) serve different purposes:
- `--pass` (green): pass status indicators, A-grade scores — **score/status colors only**
- `--accent` (blue): links, hover states, active UI chrome, score block border, meter fill for B-grade

When changing the accent color, do NOT change pass/fail/warn status colors. They are independent.
Previously broke this by applying a blue accent change to pass-colored score readouts.

## ⚠ Known Mistakes — Do Not Repeat

1. **Run button hover stayed green after accent color change** — `#auditBtn:hover` had a hardcoded old green hex (`#00ffaa`) that was missed during the accent color sweep. Always grep for hardcoded color hex values when changing a theme color.

2. **Pass score color turned blue after accent change** — `gradeColor()` in `index.html` was returning the accent color for scores ≥90, which should always be `--pass` (green). Status colors (pass/warn/fail) must never inherit from the accent color.

3. **PDF dark background not rendering (Puppeteer v24, Windows)** — `printBackground: true` and `print-color-adjust: exact` alone are insufficient. `page.setContent()` strips backgrounds; must use `page.goto('file:///')` with a temp file. Also requires `--force-color-profile=srgb` and `--run-all-compositor-stages-before-draw` launch args. Confirmed working as of current setup.

## Server Notes

- `open` package (v9+) is ESM-only — use `import('open').then(m => m.default(url))`, not `require('open')`
- Template is compiled fresh on every `generatePDF()` call — no restart needed after editing `report.hbs`
- `/download` route serves the most recently modified `.pdf` in `/output`

## Known Issues

- `titleTag.js`, `metaDescription.js`, and `checkMetaTags.js` overlap (intentional redundancy)
- `utils/reporter.js` is legacy and unused — kept for compatibility
- PSI free tier: ~400 req/day/IP. Set `PAGESPEED_API_KEY` in `.env` to avoid 429s
- JS-rendered SPAs will score poorly — static HTML only

## Global Rules (from ~/.claude/CLAUDE.md)

- Run tests after changes *(no test suite yet — add one)*
- Ask before committing
- Keep code simple
