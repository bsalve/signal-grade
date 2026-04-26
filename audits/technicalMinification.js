const AUDIT_NAME = '[Technical] Asset Minification';

module.exports = function checkMinification($, html, url) {
  const externalScripts = [];
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src && !src.startsWith('data:')) externalScripts.push(src);
  });

  const externalStyles = [];
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href && !href.startsWith('data:')) externalStyles.push(href);
  });

  const all = [...externalScripts, ...externalStyles];

  if (all.length === 0) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 60,
      message: 'No external JS or CSS assets detected — assets may be inlined or bundled.',
    };
  }

  const minified    = all.filter(p => /\.min\.(js|css)(\?.*)?$/i.test(p));
  const notMinified = all.filter(p => !/\.min\.(js|css)(\?.*)?$/i.test(p));
  const pct         = Math.round((minified.length / all.length) * 100);

  if (pct >= 80) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: `${pct}% of external assets appear minified (${minified.length}/${all.length}).`,
    };
  }

  if (pct >= 40) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 60,
      message: `${pct}% of external assets appear minified (${minified.length}/${all.length}).`,
      details: notMinified.length
        ? `Possibly unminified:\n${notMinified.map(p => `• ${p}`).join('\n')}`
        : undefined,
      recommendation:
        'Minify JavaScript and CSS assets to reduce file sizes and improve page load speed. ' +
        'Note: this check uses .min. filename conventions as a heuristic — ' +
        'bundled assets without .min. in the name may still be minified.',
    };
  }

  return {
    name: AUDIT_NAME,
    status: 'fail',
    score: 0,
    message: `Only ${pct}% of external assets appear minified (${minified.length}/${all.length}).`,
    details: notMinified.length
      ? `Possibly unminified:\n${notMinified.map(p => `• ${p}`).join('\n')}`
      : undefined,
    recommendation:
      'Most external JS and CSS assets do not appear minified. ' +
      'Use a build tool (Vite, webpack, esbuild) to minify and bundle assets. ' +
      'Minification typically reduces JS/CSS size by 30–60%, directly improving load time and Core Web Vitals.',
  };
};
