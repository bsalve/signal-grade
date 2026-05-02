'use strict';

// Post-crawl analysis: flag pages with slow server response times (TTFB).
// Returns one synthetic site-audit result + responseStats for the UI panel.

function detectSlowPages(pages) {
  const fail = [];
  const warn = [];
  const pass = [];
  const times = [];

  for (const page of pages) {
    const ms = page.responseTimeMs ?? null;
    if (ms === null) continue;
    times.push({ url: page.url, ms });
    if (ms >= 1800) {
      fail.push(page.url);
    } else if (ms >= 800) {
      warn.push(page.url);
    } else {
      pass.push(page.url);
    }
  }

  // Compute avg and p95
  let avgResponseMs = null;
  let p95ResponseMs = null;
  if (times.length > 0) {
    const sorted = [...times].sort((a, b) => a.ms - b.ms);
    avgResponseMs = Math.round(times.reduce((s, t) => s + t.ms, 0) / times.length);
    const p95Idx  = Math.floor(sorted.length * 0.95);
    p95ResponseMs = sorted[Math.min(p95Idx, sorted.length - 1)].ms;
  }

  // Slowest 5 pages for the UI panel
  const slowest = [...times].sort((a, b) => b.ms - a.ms).slice(0, 5);

  return [{
    name: '[Technical] Slow Server Response',
    fail,
    warn,
    pass,
    message: fail.length > 0
      ? `${fail.length} page${fail.length !== 1 ? 's have' : ' has'} TTFB ≥ 1800ms — critically slow`
      : warn.length > 0
        ? `${warn.length} page${warn.length !== 1 ? 's have' : ' has'} TTFB 800–1800ms — needs improvement`
        : times.length > 0
          ? `All pages respond in under 800ms`
          : 'No response time data available',
    recommendation: fail.length > 0 || warn.length > 0
      ? 'Slow server response time (TTFB) directly impacts Core Web Vitals and crawler efficiency. ' +
        'Investigate server-side rendering time, database query performance, and caching headers. ' +
        'A CDN or edge caching layer can dramatically reduce TTFB for static or semi-static content.'
      : null,
    avgResponseMs,
    p95ResponseMs,
    slowest,
  }];
}

module.exports = { detectSlowPages };
