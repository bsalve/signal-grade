'use strict';

const GBP_PATTERNS = [
  /google\.com\/maps/i,
  /maps\.google\./i,
  /business\.google\.com/i,
  /g\.co\//i,
  /goo\.gl\/maps/i,
];

function isGbpUrl(url) {
  return GBP_PATTERNS.some(re => re.test(url));
}

function geoGoogleBusinessProfileAudit($, html) {
  // 1. Check JSON-LD sameAs for GBP URLs
  let inSameAs = false;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (inSameAs) return;
    try {
      const data = JSON.parse($(el).html());
      const objects = data['@graph'] ? data['@graph'] : [data];
      for (const obj of objects) {
        const sameAs = obj.sameAs;
        if (!sameAs) continue;
        const urls = Array.isArray(sameAs) ? sameAs : [sameAs];
        if (urls.some(u => isGbpUrl(String(u)))) {
          inSameAs = true;
          break;
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  // 2. Check visible <a href> links on page
  let asPageLink = false;
  $('a[href]').each((_, el) => {
    if (asPageLink) return;
    const href = $(el).attr('href') || '';
    if (isGbpUrl(href)) asPageLink = true;
  });

  if (!inSameAs && !asPageLink) {
    return {
      name: '[GEO] Google Business Profile',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No Google Business Profile link found on this page or in schema.',
      recommendation:
        'Add a visible link to your Google Business Profile (e.g. "View on Google Maps") on your homepage or contact page. ' +
        'Also add your GBP URL to the "sameAs" array in your LocalBusiness schema. ' +
        'This directly connects your website to your GBP entity in Google\'s knowledge graph.',
    };
  }

  if (inSameAs && !asPageLink) {
    return {
      name: '[GEO] Google Business Profile',
      status: 'warn',
      score: 60,
      maxScore: 100,
      message: 'Google Business Profile URL found in sameAs schema but not as a visible page link.',
      details: 'sameAs: present · Visible link: missing',
      recommendation:
        'Add a visible "View on Google Maps" or "Google Business Profile" link to the page — ' +
        'ideally in the footer or contact section. A visible link reinforces the GBP entity association ' +
        'for both users and AI engines.',
    };
  }

  return {
    name: '[GEO] Google Business Profile',
    status: 'pass',
    score: 100,
    maxScore: 100,
    message: 'Google Business Profile link found' + (inSameAs ? ' (page link + sameAs schema).' : ' as a visible page link.'),
    details: `Page link: ${asPageLink ? 'present' : 'missing'} · sameAs: ${inSameAs ? 'present' : 'missing'}`,
  };
}

module.exports = geoGoogleBusinessProfileAudit;
