'use strict';

const AUDIT_NAME = '[Technical] Cookie Consent';

const CONSENT_SCRIPT_DOMAINS = [
  'cookiebot.com', 'onetrust.com', 'cookielaw.org', 'consentmanager.net',
  'trustarc.com', 'usercentrics.eu', 'didomi.io',
];

const CONSENT_CLASS_PATTERN = /\b(cookie|gdpr|consent|cookiebot|onetrust|cookielaw|cookie-banner|cc-banner|cookie-notice|cookie-popup)\b/i;

module.exports = function checkCookieConsent($, html) {
  // Check 1: known CMP platform script tag
  let hasConsentScript = false;
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (CONSENT_SCRIPT_DOMAINS.some(d => src.includes(d))) {
      hasConsentScript = true;
      return false; // break
    }
  });

  if (hasConsentScript) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'Consent Management Platform (CMP) script detected.',
      details: 'A recognized CMP (CookieBot, OneTrust, CookieLaw, ConsentManager, TrustArc, Usercentrics, or Didomi) was found.',
    };
  }

  // Check 2: DOM element with matching class or id
  let hasDomBanner = false;
  $('[class],[id]').each((_, el) => {
    const cls = $(el).attr('class') || '';
    const id  = $(el).attr('id') || '';
    if (CONSENT_CLASS_PATTERN.test(cls) || CONSENT_CLASS_PATTERN.test(id)) {
      hasDomBanner = true;
      return false; // break
    }
  });

  if (hasDomBanner) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 80,
      message: 'Cookie consent banner detected via DOM class/id.',
    };
  }

  // Check 3: data attributes or raw HTML pattern
  let hasPartialSignal = false;
  $('[data-cookieconsent],[data-cc],[data-gdpr]').each(() => {
    hasPartialSignal = true;
    return false;
  });
  if (!hasPartialSignal) {
    hasPartialSignal = /cookieconsent|gdpr[-_]banner|cookie[-_]notice/i.test(html);
  }

  if (hasPartialSignal) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'Partial cookie consent signals detected — verify a full consent implementation is present.',
      recommendation:
        'Consent-related data attributes or strings were found but no clear banner or CMP script. ' +
        'Ensure your consent mechanism is visible and functional for GDPR/CCPA compliance.',
    };
  }

  return {
    name: AUDIT_NAME,
    status: 'warn',
    score: 0,
    message: 'No cookie consent mechanism detected.',
    recommendation:
      'If your site sets cookies (analytics, advertising, or functional), you are likely required by GDPR and CCPA ' +
      'to obtain informed user consent before setting non-essential cookies. ' +
      'Implement a Consent Management Platform (CookieBot, OneTrust, or an open-source equivalent) ' +
      'or add a clearly labelled cookie consent banner.',
  };
};
