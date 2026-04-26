const AUDIT_NAME = '[Technical] Resource Hints';

module.exports = function checkPreconnect($, html, url) {
  const preconnects  = $('link[rel="preconnect"]').length;
  const dnsPrefetch  = $('link[rel="dns-prefetch"]').length;
  const preloads     = $('link[rel="preload"]').length;

  const total = preconnects + dnsPrefetch + preloads;

  const preconnectHrefs = [];
  $('link[rel="preconnect"]').each((_, el) => {
    const h = $(el).attr('href');
    if (h) preconnectHrefs.push(h);
  });

  if (preconnects > 0) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: `${total} resource hint(s) found — including ${preconnects} preconnect.`,
      details: preconnectHrefs.length
        ? `Preconnect targets: ${preconnectHrefs.join(', ')}`
        : undefined,
    };
  }

  if (dnsPrefetch > 0 || preloads > 0) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 60,
      message: `${total} resource hint(s) found (dns-prefetch/preload only — no preconnect).`,
      recommendation:
        'Add <link rel="preconnect"> for your most critical third-party origins (fonts, CDN, analytics). ' +
        'Preconnect performs a full TCP+TLS handshake early, shaving 100–300ms off first-request latency. ' +
        'dns-prefetch is a lighter fallback that only resolves DNS.',
    };
  }

  return {
    name: AUDIT_NAME,
    status: 'fail',
    score: 0,
    message: 'No resource hints found (preconnect, dns-prefetch, or preload).',
    recommendation:
      'Add resource hints to speed up loading of third-party assets. ' +
      'Example: <link rel="preconnect" href="https://fonts.googleapis.com"> ' +
      'Place these in <head> before your font or analytics scripts to reduce render-blocking latency.',
  };
};
