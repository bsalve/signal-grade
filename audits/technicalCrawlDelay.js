const axios = require('axios');

const AUDIT_NAME = '[Technical] Crawl Delay';

module.exports = async function checkCrawlDelay($, html, url) {
  let baseUrl;
  try {
    const parsed = new URL(url);
    baseUrl = `${parsed.protocol}//${parsed.host}`;
  } catch {
    return { name: AUDIT_NAME, status: 'warn', score: 50, message: 'Could not determine domain root.' };
  }

  let body;
  try {
    const res = await axios.get(`${baseUrl}/robots.txt`, {
      timeout: 8000,
      maxRedirects: 3,
      validateStatus: s => s < 400,
      headers: { 'User-Agent': 'SignalGrade/1.0' },
    });
    body = String(res.data);
  } catch {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'robots.txt not found — no Crawl-delay directive.',
    };
  }

  const lines = body.split('\n').map(l => l.trim());
  let inScope = false;
  let crawlDelay = null;

  for (const line of lines) {
    if (/^user-agent:\s*(\*|googlebot)$/i.test(line)) { inScope = true; continue; }
    if (/^user-agent:/i.test(line)) { inScope = false; continue; }
    if (!inScope) continue;

    const match = line.match(/^crawl-delay:\s*(\d+(?:\.\d+)?)/i);
    if (match) {
      crawlDelay = parseFloat(match[1]);
      break;
    }
  }

  if (crawlDelay === null) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'No Crawl-delay directive found — Googlebot can crawl at its natural rate.',
    };
  }

  if (crawlDelay >= 2) {
    return {
      name: AUDIT_NAME,
      status: 'fail',
      score: 0,
      message: `Crawl-delay: ${crawlDelay}s — significantly limits how fast search engines can index your site.`,
      recommendation:
        'Remove the Crawl-delay directive or reduce it to 0–1 seconds. ' +
        'A high crawl delay means Googlebot visits fewer pages per day, ' +
        'which can delay indexing of new content and slow down discovery of site changes. ' +
        'If you are concerned about server load, use Google Search Console to limit crawl rate instead.',
    };
  }

  return {
    name: AUDIT_NAME,
    status: 'warn',
    score: 50,
    message: `Crawl-delay: ${crawlDelay}s — may reduce crawl frequency.`,
    recommendation:
      'Consider removing the Crawl-delay directive to allow search engines to crawl at their optimal rate. ' +
      'Even a small delay compounds across a large site, reducing the number of pages indexed per day.',
  };
};
