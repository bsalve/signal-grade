'use strict';

const fs      = require('fs');
const path    = require('path');
const express = require('express');

// Load .env if present (mirrors index.js behaviour)
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch (_) {}

const { fetchPage }              = require('./utils/fetcher');
const { generatePDF }            = require('./utils/generatePDF');
const { calcTotalScore, letterGrade, buildJsonOutput } = require('./utils/score');
const { crawlSite, aggregateResults } = require('./utils/crawler');

// Auto-load every .js file in /audits (same as index.js)
const auditsDir = path.join(__dirname, 'audits');
const audits = fs
  .readdirSync(auditsDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => require(path.join(auditsDir, f)));

// Load .env if present
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch (_) {}

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve generated PDFs for download
app.use('/output', express.static(path.join(__dirname, 'output')));

// Main UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Run audit
app.post('/audit', async (req, res) => {
  const { url, logoUrl } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  // Validate logoUrl if provided — must be http/https only
  let safeLogoUrl = null;
  if (logoUrl && typeof logoUrl === 'string') {
    try {
      const parsed = new URL(logoUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        safeLogoUrl = logoUrl;
      }
    } catch {}
  }

  try {
    const { html, $, headers, finalUrl, responseTimeMs } = await fetchPage(url);
    const meta = { headers, finalUrl, responseTimeMs };
    const results     = (await Promise.all(audits.map((a) => a($, html, url, meta)))).flat();
    const score       = calcTotalScore(results);
    const grade       = letterGrade(score);
    const jsonOutput  = buildJsonOutput(url, results, score, grade);
    const pdfPath     = await generatePDF(jsonOutput, { logoUrl: safeLogoUrl });
    const pdfFile     = path.basename(pdfPath);

    res.json({ ...jsonOutput, pdfFile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Site-wide crawl — streams progress via SSE, returns aggregate results
app.get('/crawl', async (req, res) => {
  const rawUrl = (req.query.url || '').trim();
  if (!rawUrl) return res.status(400).json({ error: 'url required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const pages = await crawlSite(rawUrl, {
      maxPages: 50,
      onProgress: (evt) => send(evt),
    });
    send({ type: 'done', pageCount: pages.length, results: aggregateResults(pages) });
  } catch (err) {
    send({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

// Download most recently generated PDF
app.get('/download', (req, res) => {
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) return res.status(404).send('No reports generated yet.');

  const latest = fs.readdirSync(outputDir)
    .filter((f) => f.endsWith('.pdf'))
    .map((f) => ({ f, t: fs.statSync(path.join(outputDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0];

  if (!latest) return res.status(404).send('No PDF found.');
  res.download(path.join(outputDir, latest.f));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`SignalGrade running at http://localhost:${PORT}`);
  import('open').then((m) => m.default(`http://localhost:${PORT}`));
});
