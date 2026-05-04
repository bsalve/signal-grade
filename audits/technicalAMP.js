'use strict';

// AMP page detection and validation.
// Checks for <link rel="amphtml">, then fetches and validates the AMP page.
// Skipped in site crawl (extra HTTP requests — listed in SKIP_AUDITS).

async function technicalAMPAudit($, html, url) {
  const ampHref = $('link[rel="amphtml"]').attr('href');

  if (!ampHref) {
    return {
      name: '[Technical] AMP Page',
      status: 'warn',
      score: 50,
      maxScore: 100,
      message: 'No AMP version detected',
      recommendation:
        'AMP is not required, but an AMP version can improve mobile page speed and may receive ' +
        'preferential treatment in some Google search features. If your content is article-based, ' +
        'consider implementing AMP.',
    };
  }

  // Resolve the AMP URL
  let ampUrl;
  try {
    ampUrl = new URL(ampHref, url).href;
  } catch {
    return {
      name: '[Technical] AMP Page',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: `AMP link found but URL is malformed: ${ampHref}`,
      recommendation: 'Fix the href value on your <link rel="amphtml"> tag to point to a valid absolute or relative URL.',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(ampUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SearchGrade/1.0)' },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        name: '[Technical] AMP Page',
        status: 'fail',
        score: 0,
        maxScore: 100,
        message: `AMP page returned HTTP ${res.status}`,
        recommendation: 'The AMP version of this page is unreachable. Fix the server error or remove the <link rel="amphtml"> tag until the AMP page is working.',
      };
    }

    const ampHtml = await res.text();
    const issues = [];

    // Check for ⚡ or amp attribute on <html>
    const hasAmpAttr = /^<html[^>]+(⚡|amp\b)/i.test(ampHtml.trimStart()) ||
                       ampHtml.match(/<html[^>]+(⚡|[\s]amp[\s>])/i);
    if (!hasAmpAttr) issues.push('Missing ⚡ or amp attribute on <html> tag');

    // Check for canonical back-link
    const hasCanonical = /<link[^>]+rel=["']canonical["'][^>]+>/i.test(ampHtml);
    if (!hasCanonical) issues.push('Missing <link rel="canonical"> pointing back to the original page');

    // Check for <amp-img> usage (regular <img> not allowed in AMP body)
    const hasRegularImg = /<img\b/i.test(ampHtml.replace(/<head[\s\S]*?<\/head>/i, ''));
    if (hasRegularImg) issues.push('Found <img> tag in body — AMP requires <amp-img>');

    if (issues.length === 0) {
      return {
        name: '[Technical] AMP Page',
        status: 'pass',
        score: 100,
        maxScore: 100,
        message: 'AMP version found and valid',
        details: ampUrl,
      };
    }

    return {
      name: '[Technical] AMP Page',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: `AMP version found but has ${issues.length} validation issue${issues.length !== 1 ? 's' : ''}`,
      details: issues.join('\n'),
      recommendation: 'Fix the AMP validation issues listed. Invalid AMP pages are excluded from AMP-specific search features and may rank lower on mobile.',
    };
  } catch {
    return {
      name: '[Technical] AMP Page',
      status: 'warn',
      score: 50,
      maxScore: 100,
      message: 'AMP link found but page could not be fetched',
    };
  }
}

module.exports = technicalAMPAudit;
