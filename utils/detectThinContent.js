'use strict';

// Post-crawl analysis: flag pages with low word counts across a site crawl.
// Returns one synthetic site-audit result in the same shape as aggregateResults() output.

function detectThinContent(pages) {
  const fail = [];
  const warn = [];
  const pass = [];

  for (const page of pages) {
    const wc = page.wordCount ?? 0;
    if (wc < 300) {
      fail.push(page.url);
    } else if (wc <= 500) {
      warn.push(page.url);
    } else {
      pass.push(page.url);
    }
  }

  const total = fail.length + warn.length + pass.length;

  return [{
    name: '[Content] Thin Content Pages',
    fail,
    warn,
    pass,
    message: fail.length > 0
      ? `${fail.length} page${fail.length !== 1 ? 's have' : ' has'} fewer than 300 words — likely too thin for search engines`
      : warn.length > 0
        ? `${warn.length} page${warn.length !== 1 ? 's have' : ' has'} between 300–500 words — consider expanding`
        : `All ${total} crawled pages have sufficient word count (500+ words)`,
    recommendation: fail.length > 0 || warn.length > 0
      ? 'Pages with fewer than 300 words are often considered thin content by search engines and may rank poorly. ' +
        'Expand thin pages with useful, relevant content. If a page intentionally has little text (e.g., a contact or ' +
        'landing page), consider adding supporting copy, FAQs, or structured data to improve its perceived value.'
      : null,
  }];
}

module.exports = { detectThinContent };
