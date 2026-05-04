const axios  = require('axios');
const AUDIT_NAME = '[Technical] Canonical Chain';

module.exports = async function ($, html, url, meta) {
  const canonicalHref = $('link[rel="canonical"]').attr('href') || '';

  if (!canonicalHref) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'No canonical tag found — chain check skipped.',
    };
  }

  let canonicalUrl;
  try {
    canonicalUrl = new URL(canonicalHref, (meta && meta.finalUrl) || url).href;
  } catch {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'Canonical URL is malformed — chain check skipped.',
      details: `Value: ${canonicalHref}`,
    };
  }

  // Self-referencing canonical — no chain to follow
  const pageUrl = ((meta && meta.finalUrl) || url).replace(/\/$/, '');
  if (canonicalUrl.replace(/\/$/, '') === pageUrl) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'Canonical is self-referencing — no chain.',
    };
  }

  // Fetch the canonical target and check its own canonical
  try {
    const res = await axios.get(canonicalUrl, {
      timeout: 10000,
      maxRedirects: 3,
      validateStatus: s => s < 400,
      headers: { 'User-Agent': 'SearchGrade/1.0' },
    });

    const body = String(res.data);
    // Extract canonical from the fetched page with a regex (no cheerio available here)
    const match = body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
      || body.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);

    if (!match) {
      // Canonical target has no canonical of its own — clean
      return {
        name: AUDIT_NAME,
        status: 'pass',
        score: 100,
        message: 'Canonical target has no further canonical — no chain detected.',
        details: `Canonical: ${canonicalUrl}`,
      };
    }

    const targetCanonical = new URL(match[1], canonicalUrl).href.replace(/\/$/, '');
    if (targetCanonical === canonicalUrl.replace(/\/$/, '')) {
      // Target self-canonicalises — clean
      return {
        name: AUDIT_NAME,
        status: 'pass',
        score: 100,
        message: 'Canonical chain is clean — target self-canonicalises.',
        details: `Canonical: ${canonicalUrl}`,
      };
    }

    // Chain detected: this page → A → B
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 40,
      message: 'Canonical chain detected — this page canonicalises to a URL that itself points elsewhere.',
      details: `This page → ${canonicalUrl} → ${targetCanonical}`,
      recommendation:
        'Canonical chains dilute link equity and can confuse search engines about which URL is authoritative. ' +
        'Update this page\'s canonical tag to point directly to the final destination URL: ' + targetCanonical,
    };
  } catch {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'Could not fetch canonical target to check for chains.',
      details: `Canonical: ${canonicalUrl}`,
    };
  }
};
