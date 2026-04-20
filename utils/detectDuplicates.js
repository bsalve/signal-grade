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

module.exports = { detectDuplicates };
