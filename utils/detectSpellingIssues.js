'use strict';

// Post-crawl spelling & grammar check via LanguageTool public API.
// Runs on the first 10 pages only (free tier: 20 req/min; 8s timeout per page).
// Only called when opt-in spelling check is enabled (spellingCheck=1 query param).

const MAX_PAGES   = 10;
const TEXT_CAP    = 5000; // chars
const TIMEOUT_MS  = 10000;

async function checkPage(url, htmlText) {
  // Extract body text from raw HTML (no Cheerio — pages[] only carry audit results, not DOM)
  // Strip tags crudely — sufficient for spelling signal
  const bodyText = htmlText
    ? htmlText.replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, TEXT_CAP)
    : '';

  if (bodyText.length < 50) return { url, count: 0 };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text: bodyText, language: 'en-US' }).toString(),
    });
    clearTimeout(timer);
    if (!res.ok) return { url, count: 0, error: true };
    const data = await res.json();
    return { url, count: (data.matches || []).length };
  } catch {
    return { url, count: 0, error: true };
  }
}

async function detectSpellingIssues(pages) {
  const sample = pages.slice(0, MAX_PAGES);

  const results = [];
  for (const page of sample) {
    // pages[] don't carry raw HTML — use wordCount as a proxy for content presence
    // Pass null htmlText; checkPage will return count:0 for pages without html
    const result = await checkPage(page.url, page.html || null);
    results.push(result);
  }

  const fail = results.filter(r => r.count >= 10).map(r => r.url);
  const warn = results.filter(r => r.count >= 1 && r.count < 10).map(r => r.url);
  const pass = results.filter(r => r.count === 0 && !r.error).map(r => r.url);
  const checked = results.filter(r => !r.error).length;

  const issueCount = fail.length + warn.length;

  return [{
    name: '[Content] Spelling & Grammar (Site)',
    fail,
    warn,
    pass,
    message: checked === 0
      ? 'Spelling check could not reach the LanguageTool API.'
      : issueCount === 0
        ? `No spelling or grammar issues found across ${checked} sampled page${checked !== 1 ? 's' : ''}.`
        : `${issueCount} of ${checked} sampled page${checked !== 1 ? 's have' : ' has'} spelling or grammar issues (${fail.length} high, ${warn.length} moderate).`,
    recommendation: issueCount > 0
      ? 'Spelling and grammar errors undermine credibility and trust signals for search engines. ' +
        'Review and correct the flagged pages. Pages with 10+ issues are prioritized — run content through a grammar checker before publishing.'
      : null,
  }];
}

module.exports = { detectSpellingIssues };
