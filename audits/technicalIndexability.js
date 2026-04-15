const AUDIT_NAME = '[Technical] Page Indexability';

module.exports = function ($, html, url, meta) {
  const issues = [];

  // Check meta robots for noindex
  const metaRobots = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
  if (metaRobots.includes('noindex')) {
    issues.push('noindex directive in meta robots tag');
  }

  // Check X-Robots-Tag response header
  const xRobotsTag = ((meta && meta.headers && meta.headers['x-robots-tag']) || '').toLowerCase();
  if (xRobotsTag.includes('noindex')) {
    issues.push('noindex directive in X-Robots-Tag response header');
  }

  // Check canonical — warn if it points to a different URL
  const canonicalHref = $('link[rel="canonical"]').attr('href') || '';
  if (canonicalHref) {
    try {
      const base = (meta && meta.finalUrl) || url;
      const canonical = new URL(canonicalHref, base).href.replace(/\/$/, '');
      const page     = new URL(base).href.replace(/\/$/, '');
      if (canonical !== page) {
        issues.push(`canonical points elsewhere: ${canonicalHref}`);
      }
    } catch {}
  }

  if (issues.length === 0) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'Page is indexable — no noindex directives or conflicting canonicals found.',
    };
  }

  const hasNoindex = issues.some(i => i.includes('noindex'));

  return {
    name: AUDIT_NAME,
    status: hasNoindex ? 'fail' : 'warn',
    score: hasNoindex ? 0 : 50,
    message: hasNoindex
      ? 'Page is blocked from indexing by search engines.'
      : 'Page may not be treated as the canonical version.',
    details: issues.map(i => `• ${i}`).join('\n'),
    recommendation: hasNoindex
      ? 'Remove the noindex directive to allow search engines to index this page. ' +
        'Check both the <meta name="robots"> tag and any X-Robots-Tag HTTP headers.'
      : 'The canonical tag points to a different URL. If this is the primary version of the page, ' +
        'update the canonical to point to itself. If it is intentionally a duplicate, this is expected.',
  };
};
