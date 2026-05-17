'use strict';

// Post-crawl analysis: find pages sharing identical title tags or meta descriptions.
// Returns two synthetic site-audit result objects in the same shape as aggregateResults().

function detectDuplicates(pages) {
  const byTitle   = new Map();
  const byMetaDesc = new Map();

  for (const { url, title, metaDesc } of pages) {
    if (title) {
      if (!byTitle.has(title)) byTitle.set(title, []);
      byTitle.get(title).push(url);
    }
    if (metaDesc) {
      if (!byMetaDesc.has(metaDesc)) byMetaDesc.set(metaDesc, []);
      byMetaDesc.get(metaDesc).push(url);
    }
  }

  // URLs that share a value with at least one other page
  const dupTitleUrls   = new Set();
  const dupMetaUrls    = new Set();

  for (const urls of byTitle.values())    if (urls.length > 1) urls.forEach(u => dupTitleUrls.add(u));
  for (const urls of byMetaDesc.values()) if (urls.length > 1) urls.forEach(u => dupMetaUrls.add(u));

  const allUrls = pages.map(p => p.url);

  return [
    {
      name: '[Technical] Duplicate Page Titles',
      fail: allUrls.filter(u => dupTitleUrls.has(u)),
      warn: [],
      pass: allUrls.filter(u => !dupTitleUrls.has(u)),
      message: dupTitleUrls.size > 0
        ? `${dupTitleUrls.size} page${dupTitleUrls.size !== 1 ? 's share' : ' shares'} a title tag with another page`
        : 'All crawled page titles are unique',
      recommendation: dupTitleUrls.size > 0
        ? 'Each page should have a unique title tag that accurately describes its specific content. ' +
          'Duplicate titles confuse search engines about which page to rank and reduce click-through ' +
          'rates by showing identical results in SERPs.'
        : null,
    },
    {
      name: '[Technical] Duplicate Meta Descriptions',
      fail: allUrls.filter(u => dupMetaUrls.has(u)),
      warn: [],
      pass: allUrls.filter(u => !dupMetaUrls.has(u)),
      message: dupMetaUrls.size > 0
        ? `${dupMetaUrls.size} page${dupMetaUrls.size !== 1 ? 's share' : ' shares'} a meta description with another page`
        : 'All crawled meta descriptions are unique',
      recommendation: dupMetaUrls.size > 0
        ? 'Write a unique meta description for each page that summarizes its specific content. ' +
          'Duplicate meta descriptions weaken page differentiation in search results and reduce ' +
          'the likelihood of users clicking through.'
        : null,
    },
  ];
}

function detectBodyDuplicates(pages) {
  const byHash = new Map();

  for (const { url, bodyHash } of pages) {
    if (!bodyHash) continue;
    if (!byHash.has(bodyHash)) byHash.set(bodyHash, []);
    byHash.get(bodyHash).push(url);
  }

  const dupUrls = new Set();
  for (const urls of byHash.values()) {
    if (urls.length > 1) urls.forEach(u => dupUrls.add(u));
  }

  const allUrls = pages.map(p => p.url);

  return [{
    name: '[Technical] Duplicate Page Content',
    fail: allUrls.filter(u => dupUrls.has(u)),
    warn: [],
    pass: allUrls.filter(u => !dupUrls.has(u)),
    message: dupUrls.size > 0
      ? `${dupUrls.size} page${dupUrls.size !== 1 ? 's have' : ' has'} identical body content to another page`
      : 'No pages with identical body content found',
    recommendation: dupUrls.size > 0
      ? 'Pages with identical body content compete with each other for rankings and confuse search engines ' +
        'about which version to index. Consolidate duplicate pages, use canonical tags to indicate the ' +
        'preferred version, or differentiate the content to serve distinct user intents.'
      : null,
  }];
}

/**
 * Detect URLs with multiple distinct query-string variants.
 * paramVariants: Map<normUrl, Set<queryString>> — built by crawlSite during BFS.
 */
function detectParamVariants(paramVariants) {
  if (!paramVariants || paramVariants.size === 0) {
    return [{
      name: '[Technical] URL Parameter Variants',
      fail: [],
      warn: [],
      pass: [],
      message: 'No URL parameter variants detected.',
      recommendation: null,
    }];
  }

  const fail = [];
  const warn = [];

  for (const [normUrl, variants] of paramVariants) {
    const count = variants.size;
    if (count >= 3)      fail.push(normUrl);
    else if (count >= 2) warn.push(normUrl);
  }

  if (fail.length === 0 && warn.length === 0) {
    return [{
      name: '[Technical] URL Parameter Variants',
      fail: [],
      warn: [],
      pass: [],
      message: 'No URL parameter variants detected.',
      recommendation: null,
    }];
  }

  const total = fail.length + warn.length;
  return [{
    name: '[Technical] URL Parameter Variants',
    fail,
    warn,
    pass: [],
    message: `${total} URL${total !== 1 ? 's have' : ' has'} multiple query-string variants (${fail.length} high, ${warn.length} moderate)`,
    recommendation:
      'Multiple query-string variants of the same URL (e.g. /products?page=2 and /products?page=3) ' +
      'create duplicate content and dilute link equity. Add a canonical tag pointing to the clean URL, ' +
      'or disallow parameter variants in your robots.txt using URL parameter tools in Google Search Console.',
  }];
}

module.exports = { detectDuplicates, detectBodyDuplicates, detectParamVariants };
