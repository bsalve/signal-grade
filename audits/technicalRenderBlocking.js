const AUDIT_NAME = '[Technical] Render-Blocking Resources';

module.exports = function checkRenderBlocking($, html, url) {
  // <script src> in <head> without defer or async block HTML parsing
  const blocking = [];
  $('head script[src]').each((_, el) => {
    const $el = $(el);
    if (!$el.attr('defer') && !$el.attr('async') && $el.attr('defer') !== '' && $el.attr('async') !== '') {
      blocking.push($el.attr('src') || '(script)');
    }
  });

  const count = blocking.length;

  if (count === 0) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'No render-blocking scripts found in <head>.',
    };
  }

  if (count <= 2) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 70,
      message: `${count} render-blocking script(s) found in <head>.`,
      details: blocking.map(s => `• ${s}`).join('\n'),
      recommendation:
        'Add defer or async to scripts in <head> that are not critical for initial render. ' +
        'defer preserves execution order and runs after HTML parsing; ' +
        'async executes as soon as the script loads, regardless of order.',
    };
  }

  if (count <= 5) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 40,
      message: `${count} render-blocking scripts found in <head>.`,
      details: blocking.map(s => `• ${s}`).join('\n'),
      recommendation:
        'Multiple render-blocking scripts significantly delay Time to First Byte and First Contentful Paint. ' +
        'Add defer or async to all non-critical scripts. Consider moving scripts to the bottom of <body> ' +
        'or using a script loader to load them after the page renders.',
    };
  }

  return {
    name: AUDIT_NAME,
    status: 'fail',
    score: 0,
    message: `${count} render-blocking scripts found in <head> — significant performance risk.`,
    details: blocking.map(s => `• ${s}`).join('\n'),
    recommendation:
      'This many render-blocking scripts will severely delay page rendering and hurt Core Web Vitals. ' +
      'Audit each script: add defer or async where possible, remove unused scripts, ' +
      'and consider bundling scripts to reduce the total number of requests.',
  };
};
