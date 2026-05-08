'use strict';

const STOPWORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from',
  'is','are','was','were','be','been','has','have','had','do','does','did','will',
  'would','could','should','may','might','can','not','no','so','if','as','it','its',
  'this','that','these','those','we','you','he','she','they','i','my','your','our',
  'his','her','their','com','www','https','http','html','page','pages',
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function pageKeywords(page) {
  const fromTitle = page.title ? tokenize(page.title) : [];
  let fromUrl = [];
  try {
    const path = new URL(page.url).pathname;
    fromUrl = tokenize(path.replace(/[-_/]/g, ' '));
  } catch {}
  return new Set([...fromTitle, ...fromUrl]);
}

function jaccard(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const w of setA) { if (setB.has(w)) intersection++; }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function sharedKeywords(setA, setB) {
  const shared = [];
  for (const w of setA) { if (setB.has(w)) shared.push(w); }
  return shared;
}

/**
 * Detect internal linking opportunities from crawl pages.
 * @param {Array<{url, title, outLinks}>} pages
 * @returns {Array<{fromUrl, toUrl, suggestedAnchor, similarity}>}
 */
function detectLinkOpportunities(pages) {
  if (!pages || pages.length < 2) return [];

  // Build keyword sets and outLink sets per page
  const kwSets = pages.map(p => ({ url: p.url, kw: pageKeywords(p) }));
  const outLinkSets = {};
  for (const p of pages) {
    outLinkSets[p.url] = new Set(p.outLinks || []);
  }

  const opportunities = [];

  for (let i = 0; i < pages.length; i++) {
    for (let j = 0; j < pages.length; j++) {
      if (i === j) continue;
      const a = kwSets[i];
      const b = kwSets[j];
      // Skip if A already links to B
      if (outLinkSets[a.url]?.has(b.url)) continue;

      const sim = jaccard(a.kw, b.kw);
      if (sim >= 0.25) {
        const shared = sharedKeywords(a.kw, b.kw);
        const suggestedAnchor = shared.slice(0, 3).join(' ') || pages[j].title || b.url;
        opportunities.push({ fromUrl: a.url, toUrl: b.url, suggestedAnchor, similarity: sim });
      }
    }
  }

  return opportunities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 20);
}

module.exports = { detectLinkOpportunities };
