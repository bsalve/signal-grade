'use strict';

const AUDIT_NAME = '[Technical] URL Structure';

const NON_SEMANTIC_PARAMS = new Set([
  'id', 'p', 'page_id', 'post_id', 'cat', 'tag', 'article_id', 'cid', 'pid', 'item',
]);

module.exports = function checkUrlStructure($, html, url, meta) {
  const finalUrl = meta?.finalUrl || url;
  const issues = [];
  let parsed;

  try {
    parsed = new URL(finalUrl);
  } catch {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'Could not parse the page URL.',
    };
  }

  const pathname = parsed.pathname;
  const segments = pathname.split('/').filter(Boolean);

  // 1. Path depth > 4 segments
  if (segments.length > 4) {
    issues.push(`Path depth is ${segments.length} levels deep (recommended ≤4): ${pathname}`);
  }

  // 2. Non-semantic query parameters
  const badParams = [];
  parsed.searchParams.forEach((value, key) => {
    if (NON_SEMANTIC_PARAMS.has(key.toLowerCase())) badParams.push(key);
  });
  if (badParams.length > 0) {
    issues.push(`Non-semantic query parameter(s): ${badParams.join(', ')}`);
  }

  // 3. Uppercase letters in path
  if (/[A-Z]/.test(pathname)) {
    issues.push(`Uppercase letters in URL path: ${pathname}`);
  }

  // 4. Underscores in path slugs
  if (/_/.test(pathname)) {
    issues.push(`Underscores in URL path (use hyphens instead): ${pathname}`);
  }

  // 5. URL total length > 115 characters
  if (finalUrl.length > 115) {
    issues.push(`URL is ${finalUrl.length} characters (recommended ≤115)`);
  }

  const issueCount = issues.length;
  const score  = issueCount === 0 ? 100 : issueCount === 1 ? 70 : issueCount === 2 ? 40 : 0;
  const status = issueCount === 0 ? 'pass' : issueCount <= 2 ? 'warn' : 'fail';

  if (issueCount === 0) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'URL structure is clean and SEO-friendly.',
      details: `URL: ${finalUrl}`,
    };
  }

  return {
    name: AUDIT_NAME,
    status,
    score,
    message: `${issueCount} URL structure issue(s) found.`,
    details: issues.map(i => `• ${i}`).join('\n    '),
    recommendation:
      'Use short, lowercase, hyphen-separated URLs with meaningful words. ' +
      'Avoid deep nesting (>4 levels), underscores, non-semantic parameters, and excessively long URLs. ' +
      'Clean URL structure improves crawlability and click-through rates from search results.',
  };
};
