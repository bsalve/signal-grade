'use strict';

const path = require('path');
const fs   = require('fs');
const { fetchPage } = require('./fetcher');

// Audits that make extra HTTP requests — too slow at 50-page scale
const SKIP_AUDITS = new Set([
  'checkPageSpeed.js',          // PSI API call — slow + rate-limited
  'technicalBrokenLinks.js',    // HEADs up to 20 links per page
  'technicalCanonicalChain.js', // Fetches canonical target URL
  'contentOGImageCheck.js',     // HEADs og:image URL
]);

async function crawlSite(startUrl, { maxPages = 50, onProgress } = {}) {
  const auditsDir = path.join(__dirname, '..', 'audits');
  const auditFns  = fs.readdirSync(auditsDir)
    .filter(f => f.endsWith('.js') && !SKIP_AUDITS.has(f))
    .map(f => require(path.join(auditsDir, f)));

  const origin  = new URL(startUrl).origin;
  const visited = new Set();
  const queued  = new Set([startUrl]); // O(1) dedup
  const queue   = [startUrl];
  const pages   = [];                  // { url, results[] }

  while (queue.length && pages.length < maxPages) {
    const url = queue.shift();
    queued.delete(url);
    if (visited.has(url)) continue;
    visited.add(url);

    onProgress?.({ type: 'progress', crawled: pages.length, total: maxPages, url });

    try {
      const { html, $, headers, finalUrl, responseTimeMs } = await fetchPage(url);
      const meta = { headers, finalUrl, responseTimeMs };

      const results = (await Promise.all(
        auditFns.map(fn => Promise.resolve(fn($, html, url, meta)).catch(() => null))
      )).flat().filter(Boolean);

      pages.push({ url, results });

      // Enqueue same-origin links
      $('a[href]').each((_, el) => {
        try {
          const href = new URL($(el).attr('href'), url);
          if (href.origin !== origin) return;
          const norm = href.origin + href.pathname; // strip query + fragment
          if (!visited.has(norm) && !queued.has(norm)) {
            queued.add(norm);
            queue.push(norm);
          }
        } catch {}
      });
    } catch {
      // Unreachable page — skip silently
    }
  }

  return pages;
}

function aggregateResults(pages) {
  const map = new Map();
  for (const { url, results } of pages) {
    for (const r of results) {
      if (!map.has(r.name)) map.set(r.name, { name: r.name, fail: [], warn: [], pass: [], recommendation: null, message: null });
      const bucket = map.get(r.name);
      (bucket[r.status] ?? bucket.fail).push(url);
      if (!bucket.recommendation && r.recommendation) bucket.recommendation = r.recommendation;
      if (!bucket.message && r.message) bucket.message = r.message;
    }
  }
  return [...map.values()].sort(
    (a, b) => b.fail.length - a.fail.length || b.warn.length - a.warn.length
  );
}

module.exports = { crawlSite, aggregateResults };
