const AUDIT_NAME = '[Technical] Schema Required Fields';

// Minimum required fields per schema type to be eligible for rich results
const REQUIRED = {
  LocalBusiness:   ['name', 'address'],
  Organization:    ['name', 'url'],
  Article:         ['headline', 'author', 'datePublished'],
  BlogPosting:     ['headline', 'author', 'datePublished'],
  NewsArticle:     ['headline', 'author', 'datePublished'],
  FAQPage:         ['mainEntity'],
  BreadcrumbList:  ['itemListElement'],
  Product:         ['name'],
  VideoObject:     ['name', 'description', 'thumbnailUrl', 'uploadDate'],
  HowTo:           ['name', 'step'],
  Person:          ['name'],
  Event:           ['name', 'startDate'],
  Recipe:          ['name', 'recipeIngredient', 'recipeInstructions'],
};

function collectViolations(obj, violations) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) { obj.forEach(item => collectViolations(item, violations)); return; }

  const types = obj['@type'] ? (Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']]) : [];
  for (const type of types) {
    const required = REQUIRED[type];
    if (required) {
      for (const field of required) {
        if (!obj[field]) violations.push(`${type}: missing required field "${field}"`);
      }
    }
  }

  if (Array.isArray(obj['@graph'])) {
    obj['@graph'].forEach(item => collectViolations(item, violations));
  }
}

module.exports = function ($, html, url) {
  const violations = [];
  let schemaFound = false;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      schemaFound = true;
      collectViolations(data, violations);
    } catch {}
  });

  if (!schemaFound) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'No JSON-LD schema found — required field validation skipped.',
    };
  }

  if (violations.length === 0) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'All schema types pass required field validation.',
    };
  }

  const score = violations.length <= 2 ? 60 : violations.length <= 4 ? 30 : 0;

  return {
    name: AUDIT_NAME,
    status: score >= 60 ? 'warn' : 'fail',
    score,
    message: `${violations.length} schema validation issue${violations.length > 1 ? 's' : ''} found.`,
    details: violations.map(v => `• ${v}`).join('\n'),
    recommendation:
      'Fix missing required fields in your JSON-LD schema. Missing fields prevent Google from ' +
      'generating rich results for your content. After fixing, test your schema at ' +
      'https://search.google.com/test/rich-results',
  };
};
