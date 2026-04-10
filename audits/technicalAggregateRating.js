'use strict';

function technicalAggregateRatingAudit($, html) {
  const scripts = $('script[type="application/ld+json"]');

  if (scripts.length === 0) {
    return {
      name: '[Technical] Aggregate Rating',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No JSON-LD structured data found.',
      recommendation:
        'Add an AggregateRating schema (or nest aggregateRating inside your LocalBusiness block) ' +
        'to enable star ratings in Google Search rich results.',
    };
  }

  let ratingData = null;

  scripts.each((_, el) => {
    if (ratingData) return;
    try {
      const data = JSON.parse($(el).html());
      const objects = data['@graph'] ? data['@graph'] : [data];
      for (const obj of objects) {
        // Top-level AggregateRating schema
        if (obj['@type'] === 'AggregateRating') {
          ratingData = obj;
          break;
        }
        // Nested aggregateRating inside any entity
        if (obj.aggregateRating && typeof obj.aggregateRating === 'object') {
          ratingData = obj.aggregateRating;
          break;
        }
        // Check @graph nested within an object
        if (obj['@graph']) {
          for (const inner of obj['@graph']) {
            if (inner['@type'] === 'AggregateRating') {
              ratingData = inner;
              break;
            }
            if (inner.aggregateRating && typeof inner.aggregateRating === 'object') {
              ratingData = inner.aggregateRating;
              break;
            }
          }
        }
        if (ratingData) break;
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  if (!ratingData) {
    return {
      name: '[Technical] Aggregate Rating',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No AggregateRating schema found.',
      recommendation:
        'Add an aggregateRating property to your LocalBusiness or Organization schema. ' +
        'Include ratingValue (e.g. 4.8), ratingCount, and bestRating (typically 5). ' +
        'Star ratings in search results significantly improve click-through rates.',
    };
  }

  const ratingValue = ratingData.ratingValue;
  const ratingCount = ratingData.ratingCount ?? ratingData.reviewCount;

  const hasValue = ratingValue !== undefined && ratingValue !== null && String(ratingValue).trim() !== '';
  const hasCount = ratingCount !== undefined && ratingCount !== null && String(ratingCount).trim() !== '';

  if (hasValue && hasCount) {
    return {
      name: '[Technical] Aggregate Rating',
      status: 'pass',
      score: 100,
      maxScore: 100,
      message: `Aggregate rating found: ${ratingValue} stars from ${ratingCount} review${Number(ratingCount) === 1 ? '' : 's'}.`,
      details: 'ratingValue and ratingCount both present — eligible for star rating rich results.',
    };
  }

  const missingFields = [];
  if (!hasValue) missingFields.push('ratingValue');
  if (!hasCount) missingFields.push('ratingCount');

  return {
    name: '[Technical] Aggregate Rating',
    status: 'warn',
    score: 60,
    maxScore: 100,
    message: `AggregateRating schema found but missing: ${missingFields.join(', ')}.`,
    details: hasValue ? `ratingValue: ${ratingValue}` : undefined,
    recommendation:
      `Add the missing field${missingFields.length > 1 ? 's' : ''} (${missingFields.join(', ')}) to your AggregateRating schema. ` +
      'Both ratingValue and ratingCount are required for Google to display star ratings in search results.',
  };
}

module.exports = technicalAggregateRatingAudit;
