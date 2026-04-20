const AUDIT_NAME = '[Technical] Pagination Tags';

// URL patterns that suggest paginated content
const PAGINATED_URL = /[?&](page|p|paged|pg)=\d+|\/page\/\d+|\/p\/\d+/i;

module.exports = function ($, html, url) {
  const hasNext = $('link[rel="next"]').length > 0;
  const hasPrev = $('link[rel="prev"]').length > 0;

  // Has at least one pagination tag
  if (hasNext || hasPrev) {
    // Both present = clearly a middle page — ideal
    if (hasNext && hasPrev) {
      return {
        name: AUDIT_NAME,
        status: 'pass',
        score: 100,
        message: 'Pagination tags present (rel="next" and rel="prev").',
      };
    }
    // Only one present — acceptable (could be first or last page)
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: `Pagination tag present (rel="${hasNext ? 'next' : 'prev'}").`,
      details: 'Only one direction tag found — correct if this is the first or last page of a series.',
    };
  }

  // No pagination tags — check if the URL looks paginated
  const looksPageinated = PAGINATED_URL.test(url);
  if (looksPageinated) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'URL appears paginated but has no rel="next" / rel="prev" tags.',
      details: `Paginated URL detected: ${url}`,
      recommendation:
        'Add <link rel="next"> and/or <link rel="prev"> tags in <head> to signal pagination to search ' +
        'engines and Bing. While Google deprecated these in 2019, Bing still uses them, and they remain ' +
        'a crawl efficiency signal. For page 2+, also ensure a canonical tag points to the paginated URL ' +
        '(not the first page) to avoid content consolidation.',
    };
  }

  // No pagination tags and URL doesn't look paginated — not applicable
  return {
    name: AUDIT_NAME,
    status: 'pass',
    score: 100,
    message: 'No paginated content detected on this page.',
  };
};
