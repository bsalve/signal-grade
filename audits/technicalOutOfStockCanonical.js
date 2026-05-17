'use strict';

// If a Product schema signals OutOfStock, verify a canonical tag is present
// pointing to the main product URL. This prevents OOS pages from cannibalizing
// the in-stock canonical and ensures link equity flows correctly.

module.exports = function technicalOutOfStockCanonicalAudit($, html, url, meta) {
  const scripts = $('script[type="application/ld+json"]');

  let productSchema = null;
  scripts.each((_, el) => {
    if (productSchema) return;
    try {
      const data = JSON.parse($(el).html());
      const items = data['@graph'] ? data['@graph'] : [data];
      for (const item of items) {
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        if (types.includes('Product')) { productSchema = item; break; }
      }
    } catch {}
  });

  if (!productSchema) {
    return {
      name: '[Technical] Out-of-Stock Canonical',
      status: 'warn',
      score: 50,
      maxScore: 100,
      message: 'Not applicable — no Product schema detected on this page.',
    };
  }

  const offers = productSchema.offers;
  const offersObj = Array.isArray(offers) ? offers[0] : offers;
  const availability = (offersObj?.availability || '').toLowerCase();
  const isOutOfStock = availability.includes('outofstock') || availability === 'https://schema.org/outofstock';

  if (!isOutOfStock) {
    return {
      name: '[Technical] Out-of-Stock Canonical',
      status: 'pass',
      score: 100,
      maxScore: 100,
      message: 'Product is in stock — out-of-stock canonical check not applicable.',
    };
  }

  // Product is OOS — check for canonical tag
  const canonical = $('link[rel="canonical"]').attr('href') || '';
  const hasCanonical = canonical.trim() !== '';

  // Ideally the canonical should differ from this page URL or point to the main product
  const canonicalSelf = canonical === url || canonical === (meta?.finalUrl || url);

  if (!hasCanonical) {
    return {
      name: '[Technical] Out-of-Stock Canonical',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'Out-of-stock product page has no canonical tag.',
      recommendation:
        'Add a canonical tag pointing to the main product page (in-stock version or parent category). ' +
        'Without a canonical, search engines may index this OOS variant and dilute link equity from the main product URL.',
    };
  }

  if (canonicalSelf) {
    return {
      name: '[Technical] Out-of-Stock Canonical',
      status: 'warn',
      score: 60,
      maxScore: 100,
      message: 'Out-of-stock product page has a self-referencing canonical.',
      details: `Canonical: ${canonical}`,
      recommendation:
        'Consider updating the canonical tag on this out-of-stock page to point to the in-stock parent product or category page. ' +
        'A self-referencing canonical preserves the page in the index but does not consolidate link equity to a preferred in-stock version.',
    };
  }

  return {
    name: '[Technical] Out-of-Stock Canonical',
    status: 'pass',
    score: 100,
    maxScore: 100,
    message: 'Out-of-stock product page has a canonical tag pointing to an alternate URL.',
    details: `Canonical: ${canonical}`,
  };
};
