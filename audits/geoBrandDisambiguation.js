'use strict';

const AUDIT_NAME = '[GEO] Brand Disambiguation';

const ORG_TYPES = new Set([
  'Organization', 'LocalBusiness', 'Corporation', 'EducationalOrganization',
  'NGO', 'NewsMediaOrganization', 'GovernmentOrganization', 'MedicalOrganization',
  'PerformingGroup', 'SportsOrganization', 'Airline', 'Store', 'Restaurant',
  'Hotel', 'Hospital', 'ProfessionalService',
]);

function extractOrgSchema($) {
  let org = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (org) return;
    try {
      const data  = JSON.parse($(el).html());
      const items = data['@graph'] ? data['@graph'] : [data];
      for (const item of items) {
        const type = item['@type'];
        if (typeof type === 'string' && (ORG_TYPES.has(type) || type.includes('Business'))) {
          org = item;
          break;
        }
      }
    } catch {}
  });
  return org;
}

function extractBrandName($, url) {
  const ogSite = $('meta[property="og:site_name"]').attr('content');
  if (ogSite?.trim()) return ogSite.trim();

  const title = $('title').first().text().trim();
  if (title) {
    const segment = title.split(/[|—\-]/).map(s => s.trim()).filter(Boolean)[0];
    if (segment) return segment;
  }

  if (url) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      return hostname.split('.')[0];
    } catch {}
  }

  return null;
}

module.exports = function checkBrandDisambiguation($, html, url) {
  let score = 0;
  const signals = [];
  const missing = [];

  const org       = extractOrgSchema($);
  const brandName = extractBrandName($, url);

  // Signal 1: foundingDate (+25)
  if (org?.foundingDate) {
    score += 25;
    signals.push('foundingDate in schema');
  } else {
    missing.push('foundingDate');
  }

  // Signal 2: address or location (+25)
  if (org?.address || org?.location) {
    score += 25;
    signals.push('address/location in schema');
  } else {
    missing.push('address or location');
  }

  // Signal 3: description with 20+ words (+25)
  const desc = org?.description || '';
  const descWords = desc.trim().split(/\s+/).filter(Boolean).length;
  if (descWords >= 20) {
    score += 25;
    signals.push(`description (${descWords} words)`);
  } else {
    missing.push(descWords > 0 ? `description too short (${descWords} words, need ≥20)` : 'description');
  }

  // Signal 4: brand name co-occurs with industry context in main content (+25)
  if (brandName) {
    const contentEl  = $('main, article').first();
    const contentText = contentEl.length
      ? contentEl.clone().find('script,style').remove().end().text().slice(0, 500)
      : $('body').clone().find('script,style,nav,header,footer').remove().end().text().slice(0, 500);

    // Look for brand name near two+ consecutive capitalized words (broad industry noun proxy)
    const escaped = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      escaped + '[\\s\\S]{0,100}[A-Z][a-z]+\\s+[A-Z][a-z]|[A-Z][a-z]+\\s+[A-Z][a-z][\\s\\S]{0,100}' + escaped,
      'i'
    );
    if (pattern.test(contentText)) {
      score += 25;
      signals.push('brand name with industry context in main content');
    } else {
      missing.push('brand + industry noun co-occurrence in main content');
    }
  } else {
    missing.push('could not determine brand name');
  }

  const status = score >= 75 ? 'pass' : score >= 25 ? 'warn' : 'fail';

  const detailParts = [];
  if (signals.length) detailParts.push(`Signals: ${signals.join(', ')}`);
  if (missing.length) detailParts.push(`Missing: ${missing.join(', ')}`);

  return {
    name: AUDIT_NAME,
    status,
    score,
    maxScore: 100,
    message:
      score >= 75
        ? `Strong brand disambiguation signals (${score}/100).`
        : score >= 25
        ? `Partial brand disambiguation (${score}/100) — key signals missing.`
        : `Insufficient brand disambiguation (${score}/100) — AI engines may confuse your brand with similarly-named entities.`,
    details: detailParts.join(' · ') || undefined,
    recommendation:
      missing.length === 0
        ? undefined
        : 'Brand disambiguation helps AI engines distinguish your entity from similarly-named organizations. ' +
          'Add to your Organization schema: foundingDate (e.g. "2015"), a postal address, and a ≥20-word description ' +
          'that names your industry and location. Ensure your brand name appears in main content alongside category-specific terms.',
  };
};
