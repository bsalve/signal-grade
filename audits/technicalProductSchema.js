'use strict';

// Check for Product and ItemList schema — key for e-commerce pages.
// A Product schema with offers/price/availability signals to search engines
// that the page is shoppable and eligible for rich results.

function extractSchemaObjects(scripts, $) {
  const objects = [];
  scripts.each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const items = data['@graph'] ? data['@graph'] : [data];
      for (const item of items) {
        if (item && item['@type']) objects.push(item);
      }
    } catch {}
  });
  return objects;
}

module.exports = function technicalProductSchemaAudit($, html, url, meta) {
  const scripts = $('script[type="application/ld+json"]');
  const objects = extractSchemaObjects(scripts, $);

  const productSchema = objects.find(obj => {
    const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
    return types.includes('Product');
  });

  const itemListSchema = objects.find(obj => {
    const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
    return types.includes('ItemList');
  });

  if (!productSchema && !itemListSchema) {
    return {
      name: '[Technical] Product Schema',
      status: 'warn',
      score: 50,
      maxScore: 100,
      message: 'No Product or ItemList schema detected — not applicable for non-product pages.',
      recommendation: 'If this is a product or category page, add Product schema with name, offers (price, availability, currency) to qualify for Google Shopping rich results.',
    };
  }

  const details = [];
  const missing = [];
  let score = 100;

  if (productSchema) {
    // Check key Product fields
    const requiredFields = ['name', 'offers'];
    const offerFields    = ['price', 'availability', 'priceCurrency'];
    for (const f of requiredFields) {
      if (!productSchema[f]) missing.push(f);
    }
    // Check offers object/array
    const offers = productSchema.offers;
    const offersObj = Array.isArray(offers) ? offers[0] : offers;
    if (offersObj && typeof offersObj === 'object') {
      for (const f of offerFields) {
        if (!offersObj[f]) missing.push(`offers.${f}`);
      }
    } else if (!offersObj) {
      missing.push('offers.price', 'offers.availability', 'offers.priceCurrency');
    }

    if (missing.length === 0) {
      details.push('Product schema with complete offers found.');
    } else {
      score = Math.max(0, 100 - missing.length * 15);
      details.push(`Product schema found — missing: ${missing.join(', ')}`);
    }
  }

  if (itemListSchema) {
    const itemCount = itemListSchema.itemListElement?.length || 0;
    details.push(`ItemList schema with ${itemCount} item${itemCount !== 1 ? 's' : ''} found.`);
    if (!productSchema && score === 100) score = 70; // category page without product schema — partial
  }

  const status = score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail';

  return {
    name: '[Technical] Product Schema',
    status,
    score,
    maxScore: 100,
    message: status === 'pass'
      ? 'Product schema is complete with all required fields.'
      : `Product schema found but incomplete (score: ${score}/100).`,
    details: details.join(' '),
    recommendation: missing.length > 0
      ? `Add the missing Product schema fields: ${missing.join(', ')}. ` +
        'Complete Product schema enables Google Shopping rich results, price display in SERPs, and product carousels in AI search.'
      : null,
  };
};
