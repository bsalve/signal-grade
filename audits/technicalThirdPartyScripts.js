'use strict';

const AUDIT_NAME = '[Technical] Third-Party Scripts';

module.exports = function checkThirdPartyScripts($, html, url) {
  let rootDomain;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    rootDomain = hostname.split('.').slice(-2).join('.');
  } catch {
    return { name: AUDIT_NAME, status: 'warn', score: 50, message: 'Could not parse page URL.' };
  }

  function extractThirdParty(src) {
    if (!src || src.startsWith('data:')) return null;
    try {
      const h = new URL(src, url).hostname.toLowerCase();
      return h.split('.').slice(-2).join('.') === rootDomain ? null : h;
    } catch { return null; }
  }

  const thirdParty = new Set();

  $('script[src]').each((_, el) => {
    const h = extractThirdParty($(el).attr('src'));
    if (h) thirdParty.add(h);
  });
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const h = extractThirdParty($(el).attr('href'));
    if (h) thirdParty.add(h);
  });
  $('img[src]').each((_, el) => {
    const h = extractThirdParty($(el).attr('src'));
    if (h) thirdParty.add(h);
  });
  $('iframe[src]').each((_, el) => {
    const h = extractThirdParty($(el).attr('src'));
    if (h) thirdParty.add(h);
  });

  const count = thirdParty.size;
  const score  = count <= 2 ? 100 : count <= 5 ? 70 : count <= 10 ? 40 : 0;
  const status = count <= 2 ? 'pass' : count <= 5 ? 'warn' : 'fail';

  return {
    name: AUDIT_NAME,
    status,
    score,
    message:
      count === 0
        ? 'No third-party resources detected — excellent isolation.'
        : `${count} third-party domain(s) detected.`,
    details: count > 0 ? `Domains: ${[...thirdParty].sort().join(', ')}` : undefined,
    recommendation:
      count > 5
        ? 'High third-party resource count increases page load time and introduces external failure points. ' +
          'Self-host fonts, consolidate tracking scripts via a tag manager (e.g. GTM), and remove unused widgets or embeds.'
        : count > 2
        ? 'Consider consolidating third-party scripts via a tag manager and auditing for unused resources. ' +
          'Each third-party domain adds a DNS lookup and connection overhead.'
        : undefined,
  };
};
