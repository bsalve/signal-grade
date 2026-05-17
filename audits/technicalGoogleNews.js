'use strict';

// Google News / Discover checks — only meaningful for news/blog/editorial sites.
// If no news signals are detected, returns a single not-applicable warn.

const NEWS_TYPES = new Set(['NewsArticle', 'Article', 'BlogPosting', 'ReportageNewsArticle', 'OpinionNewsArticle']);

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

module.exports = function technicalGoogleNewsAudit($, html, url, meta) {
  const scripts = $('script[type="application/ld+json"]');
  const schemaObjects = extractSchemaObjects(scripts, $);

  const newsSchema = schemaObjects.find(obj => {
    const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
    return types.some(t => NEWS_TYPES.has(t));
  });

  const hasDatePublished = newsSchema && newsSchema.datePublished;

  // If no news signals at all, return not-applicable
  if (!newsSchema) {
    return {
      name: '[Technical] News/Discover SEO',
      status: 'warn',
      score: 50,
      maxScore: 100,
      message: 'No news or article schema found — News/Discover checks not applicable.',
      details: 'Add NewsArticle or Article schema with datePublished if this is a news or editorial page.',
    };
  }

  const results = [];

  // 1. NewsArticle schema completeness
  const schemaTypes = Array.isArray(newsSchema['@type']) ? newsSchema['@type'] : [newsSchema['@type']];
  const hasNewsType = schemaTypes.some(t => t === 'NewsArticle' || t === 'ReportageNewsArticle');
  const schemaScore = hasDatePublished ? (hasNewsType ? 100 : 80) : 40;
  results.push({
    name: '[Technical] NewsArticle Schema',
    status: schemaScore >= 80 ? 'pass' : 'warn',
    score: schemaScore,
    maxScore: 100,
    message: !hasDatePublished
      ? 'Article schema found but missing datePublished — required for Google News eligibility.'
      : hasNewsType
        ? 'NewsArticle schema with datePublished found.'
        : 'Article schema found with datePublished (use NewsArticle type for News eligibility).',
    recommendation: !hasDatePublished
      ? 'Add "datePublished" to your Article/NewsArticle schema. Google News requires this field to understand article freshness.'
      : !hasNewsType
        ? 'Change the schema @type to "NewsArticle" to improve eligibility for Google News. Article is accepted but NewsArticle is preferred for news publishers.'
        : null,
  });

  // 2. Google Discover image size (≥1200px recommended)
  let discoverScore = 50;
  let discoverStatus = 'warn';
  let discoverMsg = 'No large image found — Google Discover requires a representative image ≥1200px wide.';
  let discoverRec = 'Add a high-resolution representative image (≥1200px wide) to this article. Use the "max-image-preview:large" robots directive to allow Google to display it in Discover.';

  // Check og:image or schema image first
  const ogImage = $('meta[property="og:image"]').attr('content');
  const schemaImage = newsSchema.image
    ? (typeof newsSchema.image === 'string' ? newsSchema.image : newsSchema.image?.url)
    : null;

  // Check for large inline image
  let largestWidth = 0;
  $('img').each((_, el) => {
    const w = parseInt($(el).attr('width') || '0', 10);
    if (w > largestWidth) largestWidth = w;
  });

  if (largestWidth >= 1200 || (ogImage && schemaImage)) {
    discoverScore = 100; discoverStatus = 'pass';
    discoverMsg = largestWidth >= 1200
      ? `Large image found (${largestWidth}px wide) — meets Google Discover requirement.`
      : 'OG image and schema image declared — Discover eligible.';
    discoverRec = null;
  } else if (largestWidth >= 600 || ogImage || schemaImage) {
    discoverScore = 60; discoverStatus = 'warn';
    discoverMsg = `Image found but may be under 1200px wide (detected: ${largestWidth || 'unknown'}px). Google Discover prefers ≥1200px.`;
  }

  results.push({
    name: '[Technical] Google Discover Image',
    status: discoverStatus,
    score: discoverScore,
    maxScore: 100,
    message: discoverMsg,
    recommendation: discoverRec,
  });

  // 3. Google News robots access (check for Googlebot-News disallow)
  // We can only check meta robots on this page; robots.txt check is domain-level
  const metaRobots = $('meta[name="robots"]').attr('content') || '';
  const xRobotsBlocked = (meta?.headers?.['x-robots-tag'] || '').toLowerCase().includes('noindex');
  const metaBlocked = metaRobots.toLowerCase().includes('noindex');

  const newsAccessScore = (metaBlocked || xRobotsBlocked) ? 0 : 100;
  results.push({
    name: '[Technical] Google News Indexability',
    status: newsAccessScore === 100 ? 'pass' : 'fail',
    score: newsAccessScore,
    maxScore: 100,
    message: newsAccessScore === 100
      ? 'Page is indexable — no noindex directives blocking Google News.'
      : 'Page has noindex directive — Google News cannot index this article.',
    recommendation: newsAccessScore === 0
      ? 'Remove the noindex directive from this page to allow Google News to index it. Check both meta robots and X-Robots-Tag response headers.'
      : null,
  });

  return results;
};
