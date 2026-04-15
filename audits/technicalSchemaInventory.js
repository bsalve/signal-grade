const AUDIT_NAME = '[Technical] Structured Data Inventory';

function extractTypes(obj) {
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) return obj.flatMap(extractTypes);

  const types = [];
  if (obj['@type']) {
    const t = obj['@type'];
    Array.isArray(t) ? types.push(...t) : types.push(t);
  }
  if (Array.isArray(obj['@graph'])) {
    types.push(...obj['@graph'].flatMap(extractTypes));
  }
  return types;
}

module.exports = function ($, html, url) {
  const allTypes = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      allTypes.push(...extractTypes(data));
    } catch {}
  });

  const unique = [...new Set(allTypes)];

  if (unique.length === 0) {
    return {
      name: AUDIT_NAME,
      status: 'fail',
      score: 0,
      message: 'No JSON-LD structured data found on this page.',
      recommendation:
        'Add structured data using JSON-LD format in a <script type="application/ld+json"> tag. ' +
        'Start with LocalBusiness, Organization, or WebPage schema. Structured data helps search ' +
        'engines understand your content and enables rich results in Google Search.',
    };
  }

  return {
    name: AUDIT_NAME,
    status: 'pass',
    score: 100,
    message: `${unique.length} schema type${unique.length > 1 ? 's' : ''} found.`,
    details: `Found: ${unique.join(', ')}`,
  };
};
