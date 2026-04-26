const AUDIT_NAME = '[Technical] Cache-Control';

module.exports = function checkCacheControl($, html, url, meta) {
  const headers = meta?.headers ?? {};
  const raw = headers['cache-control'] || '';

  if (!raw) {
    return {
      name: AUDIT_NAME,
      status: 'fail',
      score: 0,
      message: 'No Cache-Control header found.',
      recommendation:
        'Add a Cache-Control header to instruct browsers and CDNs how long to cache your page. ' +
        'For HTML pages, "Cache-Control: no-cache, must-revalidate" is common; ' +
        'for static assets, "Cache-Control: max-age=31536000, immutable" maximizes performance.',
    };
  }

  const val = raw.toLowerCase();

  if (val.includes('no-store')) {
    return {
      name: AUDIT_NAME,
      status: 'fail',
      score: 0,
      message: 'Cache-Control: no-store prevents all caching.',
      details: `Value: ${raw}`,
      recommendation:
        'no-store disables caching entirely — every request re-downloads the page. ' +
        'Use "no-cache, must-revalidate" instead to allow revalidation without storing sensitive data, ' +
        'or set a positive max-age for cacheable resources.',
    };
  }

  const maxAgeMatch = val.match(/max-age\s*=\s*(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : -1;

  if (maxAge > 0 || val.includes('immutable')) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'Cache-Control header present with positive max-age.',
      details: `Value: ${raw}`,
    };
  }

  // no-cache or max-age=0 — caching exists but forces revalidation every request
  return {
    name: AUDIT_NAME,
    status: 'warn',
    score: 50,
    message: 'Cache-Control set but no positive max-age — every request revalidates.',
    details: `Value: ${raw}`,
    recommendation:
      'Consider adding a positive max-age for static assets (images, CSS, JS) to reduce server load ' +
      'and improve page load speed. For HTML, no-cache with a short max-age is acceptable.',
  };
};
