const AUDIT_NAME = '[Technical] HTTP Version';

module.exports = function ($, html, url, meta) {
  const headers = (meta && meta.headers) || {};

  // HTTP/3 — advertised via alt-svc: h3
  const altSvc = headers['alt-svc'] || '';
  if (/\bh3\b/i.test(altSvc)) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'Site supports HTTP/3 (QUIC).',
      details: `alt-svc: ${altSvc.split(',')[0].trim()}`,
    };
  }

  // HTTP/2 via alt-svc: h2
  if (/\bh2\b/i.test(altSvc)) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'Site supports HTTP/2.',
      details: `alt-svc: ${altSvc.split(',')[0].trim()}`,
    };
  }

  // Cloudflare always delivers HTTP/2+ — cf-ray header is a reliable signal
  if (headers['cf-ray']) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'Site is served over HTTP/2+ via Cloudflare.',
      details: `cf-ray: ${headers['cf-ray']}`,
    };
  }

  // x-firefox-spdy is set when HTTP/2 is negotiated
  if (headers['x-firefox-spdy']) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'Site is served over HTTP/2.',
      details: `x-firefox-spdy: ${headers['x-firefox-spdy']}`,
    };
  }

  // Inconclusive — Node's http module uses HTTP/1.1 internally, so absence of
  // these headers doesn't confirm HTTP/1.1; the server may still support HTTP/2
  return {
    name: AUDIT_NAME,
    status: 'warn',
    score: 50,
    message: 'HTTP version could not be confirmed from response headers.',
    details: 'No HTTP/2 or HTTP/3 signals detected. The server may still support HTTP/2.',
    recommendation:
      'Enable HTTP/2 on your server or CDN if not already active. Most modern hosts ' +
      '(Cloudflare, Nginx 1.9.5+, Apache 2.4.17+, most managed hosting) support HTTP/2 over HTTPS. ' +
      'HTTP/2 improves load speed via request multiplexing, reducing round trips.',
  };
};
