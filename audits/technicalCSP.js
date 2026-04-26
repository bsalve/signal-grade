const AUDIT_NAME = '[Technical] Content Security Policy';

module.exports = function checkCSP($, html, url, meta) {
  const headers = meta?.headers ?? {};
  const csp     = headers['content-security-policy'] || '';
  const cspRO   = headers['content-security-policy-report-only'] || '';

  if (csp) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'Content-Security-Policy header is present and enforcing.',
      details: csp.length > 120 ? csp.slice(0, 120) + '…' : csp,
    };
  }

  if (cspRO) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 60,
      message: 'Content-Security-Policy-Report-Only found — policy is not enforced.',
      details: cspRO.length > 120 ? cspRO.slice(0, 120) + '…' : cspRO,
      recommendation:
        'Report-Only mode collects violations but does not block anything. ' +
        'Once you have validated your policy using the violation reports, ' +
        'switch to the enforcing "Content-Security-Policy" header.',
    };
  }

  return {
    name: AUDIT_NAME,
    status: 'fail',
    score: 0,
    message: 'No Content-Security-Policy header found.',
    recommendation:
      'A CSP header significantly reduces the risk of XSS attacks by telling browsers ' +
      'which sources of content are trusted. Start with a report-only policy to collect violations, ' +
      'then switch to an enforcing header. Example: ' +
      '"Content-Security-Policy: default-src \'self\'; script-src \'self\' \'nonce-xxx\'".',
  };
};
