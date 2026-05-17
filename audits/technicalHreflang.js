'use strict';

// ISO 639-1 two-letter language code, optional ISO 3166-1 alpha-2 region code, or x-default
const LANG_CODE_RE = /^[a-z]{2}(-[A-Z]{2})?$|^x-default$/;

module.exports = function checkHreflang($, html, url) {
  const tags = $('link[rel="alternate"][hreflang]');

  if (tags.length === 0) {
    return {
      name: '[Technical] Hreflang Presence',
      status: 'warn',
      score: 50,
      message: 'No hreflang tags found.',
      details: 'Hreflang tags tell search engines which language/region a page targets.',
      recommendation:
        'If this site serves only one language and region, hreflang tags are not required. ' +
        'If you serve multiple languages or regions, add <link rel="alternate" hreflang="xx"> ' +
        'tags to each language variant, including an x-default fallback.',
    };
  }

  const results = [];
  const tagData = tags.toArray().map(el => ({
    lang: $(el).attr('hreflang') || '',
    href: $(el).attr('href') || '',
  }));

  // --- Sub-check 1: Presence (malformed + x-default) ---
  const malformed = tagData.filter(t => !t.lang || !t.href);
  const hasXDefault = tagData.some(t => t.lang === 'x-default');
  const langs = [...new Set(tagData.map(t => t.lang))].join(', ');

  let presenceScore, presenceStatus, presenceMsg, presenceRec;
  if (malformed.length > 0) {
    presenceScore  = 20; presenceStatus = 'fail';
    presenceMsg    = `${malformed.length} malformed hreflang tag(s) found (missing href or hreflang value).`;
    presenceRec    = 'Each hreflang tag must have both a valid hreflang language code (e.g. "en", "en-GB") and an absolute href URL. Malformed tags are ignored by search engines.';
  } else if (!hasXDefault) {
    presenceScore  = 70; presenceStatus = 'warn';
    presenceMsg    = `${tags.length} hreflang tag(s) found but no x-default fallback.`;
    presenceRec    = 'Add an x-default hreflang tag to specify the fallback page for users whose language or region does not match any declared variant: <link rel="alternate" hreflang="x-default" href="https://example.com/">';
  } else {
    presenceScore  = 100; presenceStatus = 'pass';
    presenceMsg    = `${tags.length} hreflang tag(s) found including x-default.`;
    presenceRec    = null;
  }

  results.push({
    name: '[Technical] Hreflang Presence',
    status: presenceStatus,
    score: presenceScore,
    maxScore: 100,
    message: presenceMsg,
    details: `Languages/regions declared: ${langs}`,
    recommendation: presenceRec,
  });

  // --- Sub-check 2: Language Code Validation ---
  const invalidCodes = tagData
    .filter(t => t.lang && !LANG_CODE_RE.test(t.lang))
    .map(t => t.lang);

  const langCodeScore  = invalidCodes.length === 0 ? 100 : 0;
  const langCodeStatus = invalidCodes.length === 0 ? 'pass' : 'fail';
  results.push({
    name: '[Technical] Hreflang Language Codes',
    status: langCodeStatus,
    score: langCodeScore,
    maxScore: 100,
    message: invalidCodes.length === 0
      ? 'All hreflang language codes are valid ISO 639-1 format.'
      : `${invalidCodes.length} invalid hreflang language code${invalidCodes.length > 1 ? 's' : ''} found: ${invalidCodes.slice(0, 5).join(', ')}`,
    recommendation: invalidCodes.length > 0
      ? 'Use valid ISO 639-1 language codes (e.g. "en", "fr") optionally followed by an ISO 3166-1 region code (e.g. "en-GB", "fr-CA"). Invalid codes are ignored by search engines.'
      : null,
  });

  // --- Sub-check 3: Return Links (absolute URL check) ---
  const relativeHrefs = tagData.filter(t => t.href && !t.href.startsWith('http://') && !t.href.startsWith('https://'));
  const returnLinksScore  = relativeHrefs.length === 0 ? 100 : 0;
  const returnLinksStatus = relativeHrefs.length === 0 ? 'pass' : 'fail';
  results.push({
    name: '[Technical] Hreflang Return Links',
    status: returnLinksStatus,
    score: returnLinksScore,
    maxScore: 100,
    message: relativeHrefs.length === 0
      ? 'All hreflang href values use absolute URLs.'
      : `${relativeHrefs.length} hreflang tag${relativeHrefs.length > 1 ? 's use' : ' uses'} relative URLs — these are invalid.`,
    details: relativeHrefs.length > 0
      ? `Relative hrefs: ${relativeHrefs.slice(0, 3).map(t => t.href).join(', ')}`
      : undefined,
    recommendation: relativeHrefs.length > 0
      ? 'Hreflang href values must be fully qualified absolute URLs including the scheme and domain (e.g. https://example.com/fr/). Relative URLs are not supported and will be ignored by search engines.'
      : null,
  });

  return results;
};
