'use strict';

const AUDIT_NAME = '[GEO] Knowledge Graph Entity Depth';

function analyzeGraph(obj, depth, result) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) analyzeGraph(item, depth, result);
    return;
  }
  const hasType = !!obj['@type'];
  const hasId   = !!obj['@id'];
  if (hasType) {
    result.entityCount++;
    result.maxDepth = Math.max(result.maxDepth, depth);
    if (hasId) result.idCount++;
  }
  for (const key of Object.keys(obj)) {
    if (key === '@context') continue;
    analyzeGraph(obj[key], hasType ? depth + 1 : depth, result);
  }
}

module.exports = function checkKnowledgeGraph($) {
  const result = { entityCount: 0, maxDepth: 0, idCount: 0 };

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data  = JSON.parse($(el).html());
      const items = data['@graph'] ? data['@graph'] : [data];
      for (const item of items) analyzeGraph(item, 1, result);
    } catch { /* skip malformed */ }
  });

  const { entityCount, maxDepth, idCount } = result;

  let score, status, message;

  if (entityCount === 0) {
    score = 0; status = 'fail';
    message = 'No JSON-LD entities with @type found.';
  } else if (entityCount === 1 && maxDepth <= 1) {
    score = 30; status = 'fail';
    message = 'Single flat entity found — no nested entities.';
  } else if (maxDepth >= 2 && entityCount < 2) {
    score = 60; status = 'warn';
    message = 'One top-level entity with a nested sub-entity found.';
  } else if (entityCount >= 2 && maxDepth >= 2 && idCount === 0) {
    score = 80; status = 'warn';
    message = `${entityCount} nested entities found — no @id cross-references.`;
  } else if (entityCount >= 2 && maxDepth >= 2 && idCount > 0) {
    score = 100; status = 'pass';
    message = `${entityCount} entities with nesting depth ${maxDepth} and ${idCount} @id reference(s) — strong Knowledge Graph signals.`;
  } else {
    // 2+ entities but all flat
    score = 50; status = 'warn';
    message = `${entityCount} entities found but no nesting — entities are not interconnected.`;
  }

  return {
    name: AUDIT_NAME,
    status,
    score,
    maxScore: 100,
    message,
    details: `Entities: ${entityCount} | Max nesting depth: ${maxDepth} | @id references: ${idCount}`,
    ...(score < 80 && {
      recommendation:
        'AI Knowledge Graphs benefit from interconnected, nested entity descriptions. ' +
        'Add nested entities to your JSON-LD (e.g., Organization → address → PostalAddress, ' +
        'or Person → worksFor → Organization) and use @id fields for cross-entity references. ' +
        'Each nested @type object helps AI systems build a richer, more confident entity model for your domain.',
    }),
  };
};
