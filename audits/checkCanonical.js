function checkCanonical($, html, url) {
  const canonical = $('link[rel="canonical"]');

  if (canonical.length === 0) {
    return {
      name: '[Technical] Canonical URL',
      status: 'fail',
      message: 'No canonical URL tag found.',
      recommendation:
        'Add <link rel="canonical" href="https://yourdomain.com/page/"> to the <head>. ' +
        'Canonical tags prevent duplicate content penalties when the same page is accessible ' +
        'via multiple URLs (e.g. with/without trailing slash, HTTP vs HTTPS, www vs non-www).',
    };
  }

  if (canonical.length > 1) {
    return {
      name: '[Technical] Canonical URL',
      status: 'warn',
      message: `Multiple canonical tags found (${canonical.length}). Search engines will ignore all but one.`,
      details: canonical.map((_, el) => $(el).attr('href')).get().join(' | '),
      recommendation:
        'Keep exactly one canonical tag per page. Remove the duplicates and leave only the preferred absolute URL.',
    };
  }

  const href = (canonical.first().attr('href') || '').trim();

  if (!href) {
    return {
      name: '[Technical] Canonical URL',
      status: 'warn',
      message: 'Canonical tag is present but the href is empty.',
      recommendation: 'Set the canonical href to the preferred absolute URL for this page.',
    };
  }

  return {
    name: '[Technical] Canonical URL',
    status: 'pass',
    message: 'Canonical URL is set.',
    details: href,
  };
}

module.exports = checkCanonical;
