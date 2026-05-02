'use strict';

// Post-crawl analysis: find pages that have no inbound links from other crawled pages.
// Returns one synthetic site-audit result in the same shape as aggregateResults() output.

function normUrl(u) {
  try {
    const p = new URL(u);
    return p.origin + p.pathname;
  } catch {
    return u;
  }
}

function detectOrphans(pages, startUrl) {
  const startNorm = normUrl(startUrl);

  // Build a set of all crawled URLs (normalized)
  const crawledNorms = new Set(pages.map(p => normUrl(p.url)));

  // Build inbound count map: which crawled pages are linked to by other crawled pages
  const inboundCount = new Map();
  for (const { url, outLinks = [] } of pages) {
    for (const link of outLinks) {
      const norm = normUrl(link);
      if (crawledNorms.has(norm) && norm !== normUrl(url)) {
        inboundCount.set(norm, (inboundCount.get(norm) || 0) + 1);
      }
    }
  }

  // Orphans: crawled pages with 0 inbound links, excluding the start URL
  const orphans = pages
    .map(p => p.url)
    .filter(u => normUrl(u) !== startNorm && !inboundCount.has(normUrl(u)));

  const linked = pages
    .map(p => p.url)
    .filter(u => normUrl(u) === startNorm || inboundCount.has(normUrl(u)));

  // Build ranked link equity list (all non-start pages, sorted by inbound count desc)
  const linkEquity = pages
    .map(p => ({ url: p.url, inbound: inboundCount.get(normUrl(p.url)) || 0 }))
    .sort((a, b) => b.inbound - a.inbound);

  return [{
    name: '[Technical] Orphan Pages',
    fail: orphans,
    warn: [],
    pass: linked,
    message: orphans.length > 0
      ? `${orphans.length} page${orphans.length !== 1 ? 's have' : ' has'} no inbound links from other crawled pages`
      : 'No orphan pages found — all pages have at least one internal link pointing to them',
    recommendation: orphans.length > 0
      ? 'Add internal links to these pages from relevant sections of your site such as navigation menus, ' +
        'related content sections, or sitemaps. Orphan pages receive no PageRank from internal linking ' +
        'and are harder for search engines to discover and prioritize.'
      : null,
    linkEquity,
  }];
}

module.exports = { detectOrphans };
