function checkMetaRobots($, html, url) {
  const robotsMeta = $('meta[name="robots"], meta[name="googlebot"]');

  if (robotsMeta.length === 0) {
    return {
      name: '[Technical] Meta Robots',
      status: 'pass',
      message: 'No meta robots tag found — search engines will index this page by default.',
      details: 'Default: index, follow',
    };
  }

  const directives = robotsMeta
    .map((_, el) => $(el).attr('content') || '')
    .get()
    .join(', ')
    .toLowerCase();

  if (directives.includes('noindex') || directives.includes('none')) {
    return {
      name: '[Technical] Meta Robots',
      status: 'fail',
      message: 'Page is blocked from indexing — search engines will not include this page in results.',
      details: directives,
      recommendation:
        'Unless this page should deliberately be excluded (e.g. thank-you pages, admin areas), ' +
        'remove the noindex/none directive. A noindex on a public page will remove it from all ' +
        'search engine results including Google, Bing, and AI-powered search.',
    };
  }

  if (directives.includes('nofollow')) {
    return {
      name: '[Technical] Meta Robots',
      status: 'warn',
      message: 'Page is set to nofollow — search engines will not follow links from this page.',
      details: directives,
      recommendation:
        'nofollow prevents link equity from passing to other pages. Remove this directive ' +
        'unless intentional (e.g. login pages, UGC-heavy pages).',
    };
  }

  return {
    name: '[Technical] Meta Robots',
    status: 'pass',
    message: 'Meta robots allows indexing and link following.',
    details: directives,
  };
}

module.exports = checkMetaRobots;
