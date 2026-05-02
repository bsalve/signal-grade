'use strict';

const axios = require('axios');

const AUDIT_NAME = '[GEO] sameAs Link Authority';
const MAX_SAME_AS = 5;
const TIMEOUT = 8000;

const TIER1 = ['wikipedia.org', 'wikidata.org'];
const TIER2 = ['linkedin.com', 'crunchbase.com', 'facebook.com', 'google.com', 'yelp.com'];

function getTier(hostname) {
  if (TIER1.some(d => hostname.includes(d))) return 1;
  if (TIER2.some(d => hostname.includes(d))) return 2;
  return 3;
}

module.exports = async function checkSameAsAuthority($) {
  const allSameAs = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data  = JSON.parse($(el).html());
      const items = data['@graph'] ? data['@graph'] : [data];
      for (const item of items) {
        const sa = item.sameAs;
        if (!sa) continue;
        const links = Array.isArray(sa) ? sa : [sa];
        for (const link of links) {
          if (typeof link === 'string' && link.startsWith('http') && !allSameAs.includes(link)) {
            allSameAs.push(link);
          }
        }
      }
    } catch {}
  });

  if (allSameAs.length === 0) {
    return {
      name: AUDIT_NAME,
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No sameAs links found in JSON-LD.',
      recommendation:
        'Add sameAs links to your Organization or Person schema to connect your entity to authoritative directories: ' +
        'Wikipedia, Wikidata, LinkedIn, Crunchbase, Google Business Profile, or Yelp. ' +
        'sameAs is the primary mechanism AI knowledge graphs use to verify and disambiguate entities.',
    };
  }

  const toCheck = allSameAs.slice(0, MAX_SAME_AS);

  const results = await Promise.all(toCheck.map(async (link) => {
    let hostname;
    try { hostname = new URL(link).hostname.toLowerCase(); }
    catch { return { link, status: 'invalid', points: -10 }; }

    const tier = getTier(hostname);
    try {
      const res = await axios.head(link, {
        timeout: TIMEOUT,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: { 'User-Agent': 'SignalGrade/1.0' },
      });
      // Treat 403 from known platforms as success — bots commonly get 403 from LinkedIn/Facebook
      const ok = (res.status >= 200 && res.status < 400) || (res.status === 403 && tier <= 2);
      if (!ok) return { link, status: `HTTP ${res.status}`, points: -10 };
      const pts = tier === 1 ? 25 : tier === 2 ? 15 : 5;
      return { link, status: 'ok', tier, points: pts };
    } catch {
      return { link, status: 'error', points: -10 };
    }
  }));

  const rawScore  = results.reduce((sum, r) => sum + r.points, 0);
  const capped    = Math.min(Math.max(rawScore, 0), 100);
  const allBroken = results.every(r => r.points < 0);

  const status =
    allBroken ? 'fail' :
    capped >= 50 ? 'pass' : 'warn';

  const detailLines = results.map(r =>
    r.points < 0
      ? `• ${r.link} — broken (${r.status})`
      : `• ${r.link} — Tier ${r.tier} (+${r.points}pts)`
  );

  return {
    name: AUDIT_NAME,
    status,
    score: allBroken ? 10 : capped,
    maxScore: 100,
    message:
      allBroken
        ? 'All sameAs links are broken or unreachable.'
        : capped >= 50
        ? `sameAs links verified — authority score ${capped}/100.`
        : `sameAs links present but low authority score (${capped}/100).`,
    details: `Checked ${toCheck.length} of ${allSameAs.length} sameAs link(s):\n    ` + detailLines.join('\n    '),
    recommendation:
      allBroken || capped < 50
        ? 'Add or fix sameAs links to high-authority directories. ' +
          'Priority: Wikipedia article or Wikidata entry (25pts each), ' +
          'then LinkedIn company page, Crunchbase profile, or Google Business Profile (15pts each). ' +
          'Each verified authoritative link increases AI confidence in your entity identity.'
        : undefined,
  };
};
