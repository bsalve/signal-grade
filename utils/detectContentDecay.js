'use strict';

// Post-crawl content decay detector.
// Compares GSC impressions across two 45-day periods per crawled URL.
// Also checks contentFreshness audit result per page.
// Only runs if userId + db are available AND GSC is connected.

const DECAY_THRESHOLD     = 0.3;  // >30% impression drop = decaying
const FRESHNESS_FAIL_NAME = '[Content] Content Freshness';

async function detectContentDecay(pages, userId, db) {
  if (!db || !userId || !pages || !pages.length) {
    return [{
      name: '[Content] Content Decay Risk',
      fail: [], warn: [], pass: [],
      message: 'Content decay analysis skipped — requires an active account with Google Search Console connected.',
      recommendation: null,
    }];
  }

  let gscRows;
  try {
    const path = require('path');
    const gscPath = path.join(process.cwd(), 'utils/gsc.js');
    const { getGscPageData } = require(gscPath);
    const siteUrl = pages[0]?.url || '';
    const result  = await getGscPageData(userId, siteUrl);
    if (!result.connected || !result.rows?.length) {
      return [{
        name: '[Content] Content Decay Risk',
        fail: [], warn: [], pass: [],
        message: 'Content decay analysis skipped — Google Search Console not connected or no data available.',
        recommendation: null,
      }];
    }
    gscRows = result.rows;
  } catch (err) {
    console.error('[detectContentDecay] GSC fetch failed:', err?.message);
    return [{
      name: '[Content] Content Decay Risk',
      fail: [], warn: [], pass: [],
      message: 'Content decay analysis skipped — could not fetch Google Search Console data.',
      recommendation: null,
    }];
  }

  // Build a URL → GSC data map
  const gscByUrl = new Map(gscRows.map(r => [r.page, r]));

  // Build freshness fail set from crawled pages
  const freshnessFailUrls = new Set();
  for (const page of pages) {
    for (const result of (page.results || [])) {
      if (result.name === FRESHNESS_FAIL_NAME && (result.status === 'fail' || result.status === 'warn')) {
        freshnessFailUrls.add(page.url);
      }
    }
  }

  const fail = [];
  const warn = [];
  const pass = [];

  for (const page of pages) {
    const gsc = gscByUrl.get(page.url);
    const isFresh = !freshnessFailUrls.has(page.url);

    if (!gsc) {
      // No GSC data for this URL — not enough signal
      if (!isFresh) warn.push(page.url); // stale content, no GSC data
      else pass.push(page.url);
      continue;
    }

    const { recentImpressions, olderImpressions } = gsc;
    let decayRatio = 0;
    if (olderImpressions > 0) {
      decayRatio = (olderImpressions - recentImpressions) / olderImpressions;
    }

    const isDecaying = decayRatio >= DECAY_THRESHOLD;
    const isStale    = !isFresh;

    if (isDecaying && isStale) {
      fail.push(page.url); // high decay risk: both signals
    } else if (isDecaying || isStale) {
      warn.push(page.url); // moderate: one signal
    } else {
      pass.push(page.url);
    }
  }

  const failCount = fail.length;
  const warnCount = warn.length;

  return [{
    name: '[Content] Content Decay Risk',
    fail,
    warn,
    pass,
    message: failCount === 0 && warnCount === 0
      ? 'No content decay detected across crawled pages.'
      : `${failCount} page${failCount !== 1 ? 's have' : ' has'} high decay risk` +
        (warnCount > 0 ? `, ${warnCount} more with moderate decay signals` : ''),
    recommendation: failCount > 0 || warnCount > 0
      ? 'Pages flagged for content decay show declining Google Search impressions and/or stale content dates. ' +
        'Update these pages with fresh information, expand coverage, or consolidate them into a single authoritative resource. ' +
        'Refreshing content typically recovers impressions within 4–8 weeks of re-indexing.'
      : null,
  }];
}

module.exports = { detectContentDecay };
