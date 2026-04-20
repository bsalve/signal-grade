const axios = require('axios');

const AUDIT_NAME = '[Technical] Sitemap URL Validation';
const SAMPLE_SIZE = 15;

// Extract <loc> URLs from a sitemap XML body string
function extractLocs(body) {
  const matches = body.match(/<loc>([\s\S]*?)<\/loc>/gi) || [];
  return matches.map(m => m.replace(/<\/?loc>/gi, '').trim());
}

module.exports = async function ($, html, url) {
  let baseUrl;
  try {
    const parsed = new URL(url);
    baseUrl = `${parsed.protocol}//${parsed.host}`;
  } catch {
    return { name: AUDIT_NAME, status: 'warn', score: 30, message: 'Could not determine domain root.' };
  }

  // Fetch sitemap.xml
  let sitemapBody;
  try {
    const res = await axios.get(`${baseUrl}/sitemap.xml`, {
      timeout: 8000,
      maxRedirects: 3,
      validateStatus: s => s < 400,
      headers: { 'User-Agent': 'SignalGrade/1.0' },
    });
    sitemapBody = String(res.data);
  } catch {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 30,
      message: 'No sitemap.xml found — cannot validate URLs.',
      recommendation:
        'Create an XML sitemap at /sitemap.xml and submit it to Google Search Console. ' +
        'A sitemap helps search engines discover and index all your important pages.',
    };
  }

  // If this is a sitemap index, fetch the first child sitemap
  let urlsToCheck = extractLocs(sitemapBody);
  if (/<sitemapindex/i.test(sitemapBody) && urlsToCheck.length > 0) {
    try {
      const childRes = await axios.get(urlsToCheck[0], {
        timeout: 8000,
        maxRedirects: 3,
        validateStatus: s => s < 400,
        headers: { 'User-Agent': 'SignalGrade/1.0' },
      });
      urlsToCheck = extractLocs(String(childRes.data));
    } catch {
      // Fall back to whatever locs were in the index itself
    }
  }

  if (urlsToCheck.length === 0) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 30,
      message: 'sitemap.xml found but contains no <loc> URLs.',
      recommendation:
        'Your sitemap.xml exists but lists no URLs. Add <url><loc>...</loc></url> entries for each ' +
        'page you want search engines to index.',
    };
  }

  // Sample up to SAMPLE_SIZE URLs
  const sample = urlsToCheck.slice(0, SAMPLE_SIZE);
  const results = await Promise.all(
    sample.map(async (loc) => {
      try {
        const res = await axios.head(loc, {
          timeout: 5000,
          maxRedirects: 3,
          validateStatus: () => true,
          headers: { 'User-Agent': 'SignalGrade/1.0' },
        });
        return { url: loc, status: res.status, ok: res.status < 400 };
      } catch {
        return { url: loc, status: 0, ok: false };
      }
    })
  );

  const broken = results.filter(r => !r.ok);
  const pctHealthy = Math.round((results.length - broken.length) / results.length * 100);

  let score, status, message;
  if (pctHealthy === 100) {
    score = 100; status = 'pass';
    message = `All ${sample.length} sampled sitemap URLs are reachable.`;
  } else if (pctHealthy >= 80) {
    score = 80; status = 'warn';
    message = `${broken.length} of ${sample.length} sampled sitemap URLs returned errors.`;
  } else if (pctHealthy >= 50) {
    score = 50; status = 'warn';
    message = `${broken.length} of ${sample.length} sampled sitemap URLs returned errors.`;
  } else {
    score = 0; status = 'fail';
    message = `${broken.length} of ${sample.length} sampled sitemap URLs returned errors.`;
  }

  const details = broken.length > 0
    ? `Broken URLs (HTTP status shown):\n${broken.slice(0, 5).map(r => `• ${r.url} (${r.status || 'no response'})`).join('\n')}${broken.length > 5 ? `\n• …and ${broken.length - 5} more` : ''}`
    : `Checked ${sample.length} of ${urlsToCheck.length} sitemap URLs`;

  const recommendation = broken.length > 0
    ? 'Remove broken URLs from your sitemap or fix the pages returning errors. ' +
      'Sitemap URLs with 4xx/5xx responses waste crawl budget and signal poor site health to search engines.'
    : undefined;

  return { name: AUDIT_NAME, status, score, message, details, recommendation };
};
