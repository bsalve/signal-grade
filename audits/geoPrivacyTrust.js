'use strict';

function geoPrivacyTrustAudit($, html) {
  let score = 0;
  const found = [];
  const missing = [];

  // 1. Privacy policy link (40 pts)
  const hasPrivacy = $('a').filter((_, el) => {
    const href = $(el).attr('href') || '';
    return /privacy/i.test(href);
  }).length > 0;

  if (hasPrivacy) { score += 40; found.push('Privacy policy'); }
  else missing.push('Privacy policy');

  // 2. Terms of service link (35 pts)
  const hasTerms = $('a').filter((_, el) => {
    const href = $(el).attr('href') || '';
    return /\bterms\b|\/tos\b/i.test(href);
  }).length > 0;

  if (hasTerms) { score += 35; found.push('Terms of service'); }
  else missing.push('Terms of service');

  // 3. Cookie / GDPR notice (25 pts)
  // Check for elements whose class, id, or role suggests a cookie/consent banner
  const hasCookieElement = $('*').filter((_, el) => {
    const cls  = ($(el).attr('class') || '').toLowerCase();
    const id   = ($(el).attr('id')    || '').toLowerCase();
    const role = ($(el).attr('role')  || '').toLowerCase();
    return /cookie|gdpr|consent|cookie-notice|cookie-banner/.test(cls + ' ' + id + ' ' + role);
  }).length > 0;

  // Also scan visible text for cookie consent language
  const bodyText = $('body').text().toLowerCase();
  const hasCookieText =
    /\bcookie(s)?\b/.test(bodyText) &&
    /\b(consent|accept|notice|policy|preferences|settings)\b/.test(bodyText);

  const hasCookie = hasCookieElement || hasCookieText;
  if (hasCookie) { score += 25; found.push('Cookie/GDPR notice'); }
  else missing.push('Cookie/GDPR notice');

  let status;
  if (score >= 75) status = 'pass';
  else if (score >= 25) status = 'warn';
  else status = 'fail';

  const detailParts = [];
  if (found.length)   detailParts.push(`Found: ${found.join(', ')}`);
  if (missing.length) detailParts.push(`Missing: ${missing.join(', ')}`);

  const recommendations = [];
  if (!hasPrivacy)
    recommendations.push(
      'Add a privacy policy page and link to it in the footer. A privacy policy is legally required ' +
      'in most jurisdictions under GDPR, CCPA, and similar regulations, and is a trust signal for AI models.'
    );
  if (!hasTerms)
    recommendations.push(
      'Add terms of service and link to them. This signals a professionally managed business to both ' +
      'users and AI engines that evaluate site credibility.'
    );
  if (!hasCookie)
    recommendations.push(
      'Add a cookie consent notice. Under GDPR and similar laws, sites must inform visitors about ' +
      'cookie usage. The presence of a consent mechanism is a trust signal for AI citation systems.'
    );

  return {
    name: '[GEO] Privacy & Trust Signals',
    status,
    score,
    maxScore: 100,
    message:
      score === 100
        ? 'All trust signals detected: privacy policy, terms of service, and cookie notice.'
        : score === 0
          ? 'No privacy or trust signals found.'
          : `${found.length} of 3 trust signals found (${score}/100).`,
    details: detailParts.join(' · ') || undefined,
    recommendation: recommendations.length > 0 ? recommendations.join(' ') : undefined,
  };
}

module.exports = geoPrivacyTrustAudit;
