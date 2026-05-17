'use strict';

// PageRank-style internal link authority score.
// Runs 10 iterations of damped PageRank on the crawled pages graph,
// then normalizes scores to 0–100 and buckets pages into pass/warn/fail.

const DAMPING   = 0.85;
const ITERATIONS = 10;
const FAIL_THRESHOLD = 10;  // normalized score < 10 → fail
const WARN_THRESHOLD = 30;  // normalized score < 30 → warn

function detectLinkEquityScore(pages) {
  if (!pages || pages.length === 0) {
    return [{
      name: '[Technical] Internal Link Authority',
      fail: [], warn: [], pass: [],
      message: 'No pages available for link authority analysis.',
      recommendation: null,
    }];
  }

  const N = pages.length;
  const urls = pages.map(p => p.url);
  const urlIndex = new Map(urls.map((u, i) => [u, i]));

  // Build adjacency: inLinks[v] = list of u indices that link to v
  // outDegree[u] = number of outgoing links
  const inLinks  = Array.from({ length: N }, () => []);
  const outDegree = new Array(N).fill(0);

  for (let i = 0; i < N; i++) {
    const page = pages[i];
    const seen = new Set();
    for (const link of (page.outLinks || [])) {
      const j = urlIndex.get(link);
      if (j === undefined || j === i || seen.has(j)) continue;
      seen.add(j);
      inLinks[j].push(i);
      outDegree[i]++;
    }
  }

  // Initialize PageRank
  let pr = new Array(N).fill(1 / N);

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const next = new Array(N).fill((1 - DAMPING) / N);
    for (let v = 0; v < N; v++) {
      for (const u of inLinks[v]) {
        if (outDegree[u] > 0) {
          next[v] += DAMPING * (pr[u] / outDegree[u]);
        }
      }
    }
    pr = next;
  }

  // Normalize to 0–100 (max score → 100)
  const maxPr = Math.max(...pr);
  const normalized = maxPr > 0
    ? pr.map(v => Math.round((v / maxPr) * 100))
    : new Array(N).fill(0);

  const fail = [];
  const warn = [];
  const pass = [];

  for (let i = 0; i < N; i++) {
    const score = normalized[i];
    if (score < FAIL_THRESHOLD)      fail.push(urls[i]);
    else if (score < WARN_THRESHOLD) warn.push(urls[i]);
    else                             pass.push(urls[i]);
  }

  const failCount = fail.length;
  const warnCount = warn.length;

  return [{
    name: '[Technical] Internal Link Authority',
    fail,
    warn,
    pass,
    message: failCount === 0 && warnCount === 0
      ? `All ${N} pages have sufficient internal link authority.`
      : `${failCount} page${failCount !== 1 ? 's have' : ' has'} very low internal link authority (score <${FAIL_THRESHOLD})` +
        (warnCount > 0 ? `, ${warnCount} more with moderate authority (score <${WARN_THRESHOLD})` : ''),
    recommendation: failCount > 0 || warnCount > 0
      ? 'Pages with low internal link authority receive little "link equity" from the rest of the site. ' +
        'Add internal links to these pages from related, high-traffic pages. ' +
        'Consider updating your navigation, adding related-post sections, or including contextual links within body content.'
      : null,
  }];
}

module.exports = { detectLinkEquityScore };
