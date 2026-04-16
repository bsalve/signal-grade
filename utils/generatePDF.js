'use strict';

const fs         = require('fs');
const path       = require('path');
const puppeteer  = require('puppeteer');
const Handlebars = require('handlebars');
const axios      = require('axios');

Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('isDefined', (v) => v !== undefined && v !== null);

const templatePath = path.join(__dirname, '..', 'templates', 'report.hbs');

function domainSlug(url) {
  try { return new URL(url).hostname.replace(/[^a-z0-9.-]/gi, '_'); }
  catch { return 'unknown'; }
}

function meterColor(score) {
  if (score >= 90) return '#34d399';
  if (score >= 80) return '#4d9fff';
  if (score >= 70) return '#ffb800';
  if (score >= 60) return '#ff8800';
  return '#ff4455';
}

function statusCounts(results) {
  return results.reduce(
    (acc, r) => {
      if (r.status === 'pass') acc.passCount++;
      else if (r.status === 'warn') acc.warnCount++;
      else acc.failCount++;
      return acc;
    },
    { passCount: 0, warnCount: 0, failCount: 0 }
  );
}

function groupResults(results) {
  const technical = [], content = [], aeo = [], geo = [];
  for (const r of results) {
    if (r.name.startsWith('[AEO]'))       aeo.push({ ...r, name: r.name.replace(/^\[AEO\]\s*/, '') });
    else if (r.name.startsWith('[GEO]'))  geo.push({ ...r, name: r.name.replace(/^\[GEO\]\s*/, '') });
    else if (r.name.startsWith('[Content]')) content.push({ ...r, name: r.name.replace(/^\[Content\]\s*/, '') });
    else technical.push({ ...r, name: r.name.replace(/^\[Technical\]\s*/, '') });
  }
  return { technicalResults: technical, contentResults: content, aeoResults: aeo, geoResults: geo };
}

function calcCatScore(arr) {
  if (!arr.length) return { score: 0, grade: 'F' };
  const avg = Math.round(arr.reduce((s, r) => s + (r.normalizedScore ?? 0), 0) / arr.length);
  const grade = avg >= 90 ? 'A' : avg >= 80 ? 'B' : avg >= 70 ? 'C' : avg >= 60 ? 'D' : 'F';
  return { score: avg, grade };
}

async function generatePDF(auditJson, options = {}) {
  const outputDir = options.outputDir ?? path.join(__dirname, '..', 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  const auditedAt = new Date(auditJson.auditedAt).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });

  // Read template fresh every call so edits take effect without restarting
  const template = Handlebars.compile(fs.readFileSync(templatePath, 'utf8'));

  const grouped = groupResults(auditJson.results);
  const catScores = {
    technical: calcCatScore(grouped.technicalResults),
    content:   calcCatScore(grouped.contentResults),
    aeo:       calcCatScore(grouped.aeoResults),
    geo:       calcCatScore(grouped.geoResults),
  };

  // Executive summary: top 3 critical issues and top 3 passes
  const sorted = [...auditJson.results].sort((a, b) => (a.normalizedScore ?? 0) - (b.normalizedScore ?? 0));
  const top7Fails = sorted
    .filter(r => r.status === 'fail' || r.status === 'warn')
    .slice(0, 7)
    .map(r => ({ name: r.name.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, ''), message: r.message || '', status: r.status }));
  const top7Passes = [...auditJson.results]
    .filter(r => r.status === 'pass')
    .sort((a, b) => (b.normalizedScore ?? 0) - (a.normalizedScore ?? 0))
    .slice(0, 7)
    .map(r => ({ name: r.name.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, ''), message: r.message || '' }));

  // Fetch logo and embed as base64 — avoids CORS/CORP blocks when Puppeteer
  // loads the PDF from a file:/// temp file (external URLs can be silently blocked)
  let logoUrl = null;
  if (options.logoUrl) {
    try {
      const imgRes = await axios.get(options.logoUrl, {
        responseType: 'arraybuffer',
        timeout: 8000,
        headers: { 'User-Agent': 'SignalGrade/1.0' },
      });
      const contentType = (imgRes.headers['content-type'] || 'image/png').split(';')[0];
      const base64 = Buffer.from(imgRes.data).toString('base64');
      logoUrl = `data:${contentType};base64,${base64}`;
    } catch {
      // Logo fetch failed — fall back to default SIGNALGRADE header
    }
  }

  const html = template({
    ...auditJson,
    auditedAt,
    meterColor: meterColor(auditJson.totalScore),
    ...statusCounts(auditJson.results),
    ...grouped,
    catScores,
    top7Fails,
    top7Passes,
    logoUrl,
    isSiteReport: !!options.isSiteReport,
  });

  const domain   = domainSlug(auditJson.url);
  const datePart = (auditJson.auditedAt || new Date().toISOString()).slice(0, 10);
  const prefix   = options.prefix || 'signalgrade';
  const outPath  = path.join(outputDir, `${prefix}-report-${domain}-${datePart}.pdf`);

  const tmpHtml = path.resolve(outputDir, '_tmp_report.html');
  fs.writeFileSync(tmpHtml, html, 'utf8');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--force-color-profile=srgb',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--run-all-compositor-stages-before-draw',
    ],
  });
  try {
    const page = await browser.newPage();
    await page.emulateMediaType('screen');
    await page.goto(`file:///${tmpHtml.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
  } finally {
    await browser.close();
    if (fs.existsSync(tmpHtml)) fs.unlinkSync(tmpHtml);
  }

  return outPath;
}

module.exports = { generatePDF };
