'use strict';

// Post-crawl analysis: flag pages that are too many clicks from the homepage.
// Returns one synthetic site-audit result in the same shape as aggregateResults().

function detectClickDepth(pages) {
  const deep  = pages.filter(p => p.depth >= 4).map(p => p.url);
  const mid   = pages.filter(p => p.depth === 3).map(p => p.url);
  const shallow = pages.filter(p => p.depth < 3).map(p => p.url);

  const depthDistribution = {};
  for (const p of pages) {
    depthDistribution[p.depth] = (depthDistribution[p.depth] || 0) + 1;
  }

  let status = 'pass';
  let message;
  let recommendation = null;

  if (deep.length > 0) {
    status = 'fail';
    message = `${deep.length} page${deep.length !== 1 ? 's are' : ' is'} 4+ clicks from the homepage`;
    recommendation =
      'Deep pages receive less PageRank through internal linking and are harder for crawlers to discover. ' +
      'Add links to these pages from higher-level pages (category pages, navigation, sitemaps) to bring ' +
      'them within 3 clicks of the homepage.';
  } else if (mid.length > 0) {
    status = 'warn';
    message = `${mid.length} page${mid.length !== 1 ? 's are' : ' is'} 3 clicks from the homepage — consider flattening the structure`;
  } else {
    message = `All pages are within 2 clicks of the homepage`;
  }

  return [{
    name: '[Technical] Click Depth',
    fail: deep,
    warn: mid,
    pass: shallow,
    message,
    recommendation,
    depthDistribution,
  }];
}

module.exports = { detectClickDepth };
