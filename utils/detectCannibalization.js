'use strict';

// Post-crawl analysis: find pages with highly similar title keywords (Jaccard similarity).
// Returns a single synthetic site-audit result in the same shape as aggregateResults().

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'in', 'on', 'of', 'to', 'is', 'are', 'was', 'for', 'at', 'by', 'with', 'from']);

function titleWords(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function jaccard(setA, setB) {
  const intersection = new Set([...setA].filter(w => setB.has(w)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function detectCannibalization(pages) {
  const pagesWithTitles = pages.filter(p => p.title && p.title.trim());

  const cannibPairs = [];
  const cannibUrls = new Set();

  for (let i = 0; i < pagesWithTitles.length; i++) {
    const wordsI = new Set(titleWords(pagesWithTitles[i].title));
    if (wordsI.size === 0) continue;
    for (let j = i + 1; j < pagesWithTitles.length; j++) {
      const wordsJ = new Set(titleWords(pagesWithTitles[j].title));
      if (wordsJ.size === 0) continue;
      if (jaccard(wordsI, wordsJ) > 0.6) {
        cannibPairs.push(`${pagesWithTitles[i].url} ↔ ${pagesWithTitles[j].url}`);
        cannibUrls.add(pagesWithTitles[i].url);
        cannibUrls.add(pagesWithTitles[j].url);
      }
    }
  }

  const allUrls = pages.map(p => p.url);
  const hasCannib = cannibPairs.length > 0;

  return [{
    name: '[Technical] Keyword Cannibalization',
    fail: cannibPairs,
    warn: [],
    pass: allUrls.filter(u => !cannibUrls.has(u)),
    message: hasCannib
      ? `${cannibPairs.length} pair${cannibPairs.length !== 1 ? 's' : ''} of pages share highly similar title keywords`
      : 'No keyword cannibalization detected across crawled pages',
    recommendation: hasCannib
      ? 'Pages with similar titles compete for the same search queries, splitting ranking signals. ' +
        'Differentiate each page\'s title and primary keyword focus, or consolidate competing pages ' +
        'into a single authoritative page with a canonical redirect.'
      : null,
  }];
}

module.exports = { detectCannibalization };
