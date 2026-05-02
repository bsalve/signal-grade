'use strict';

const axios = require('axios');

const AUDIT_NAME = '[Technical] JavaScript Bundle Size';
const MAX_SCRIPTS = 5;

module.exports = async function checkJsBundleSize($, html, url) {
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return { name: AUDIT_NAME, status: 'warn', score: 50, message: 'Could not parse page URL.' };
  }

  // Collect same-origin script URLs
  const scriptUrls = [];
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (!src || src.startsWith('data:')) return;
    try {
      const resolved = new URL(src, url);
      if (resolved.origin === origin) scriptUrls.push(resolved.href);
    } catch {}
  });

  if (scriptUrls.length === 0) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 60,
      message: 'No same-origin external scripts found — JavaScript may be inlined or served from a CDN.',
    };
  }

  const toCheck = scriptUrls.slice(0, MAX_SCRIPTS);
  const capped  = scriptUrls.length > MAX_SCRIPTS;

  let totalBytes = 0;
  let missingContentLength = 0;

  await Promise.all(toCheck.map(async (src) => {
    try {
      const res = await axios.head(src, {
        timeout: 8000,
        validateStatus: () => true,
        headers: { 'User-Agent': 'SignalGrade/1.0' },
      });
      const cl = parseInt(res.headers['content-length'] || '', 10);
      if (!isNaN(cl)) {
        totalBytes += cl;
      } else {
        missingContentLength++;
      }
    } catch {
      missingContentLength++;
    }
  }));

  if (totalBytes === 0 && missingContentLength === toCheck.length) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: `Found ${scriptUrls.length} same-origin script(s) but none returned a Content-Length header.`,
      recommendation:
        'Your server does not return Content-Length for scripts (common with chunked encoding or dynamic responses). ' +
        'Consider enabling Content-Length on your web server or using a CDN that reports file sizes.',
    };
  }

  const cappedNote  = capped ? ` (sampled first ${MAX_SCRIPTS} of ${scriptUrls.length})` : '';
  const missingNote = missingContentLength > 0 ? ` (${missingContentLength} script(s) lacked Content-Length)` : '';
  const kb = Math.round(totalBytes / 1024);

  const score  = totalBytes < 200 * 1024 ? 100 : totalBytes < 500 * 1024 ? 70 : totalBytes < 1024 * 1024 ? 40 : 0;
  const status = totalBytes < 200 * 1024 ? 'pass' : totalBytes < 500 * 1024 ? 'warn' : 'fail';
  const label  =
    totalBytes < 200 * 1024  ? 'Good (<200 KB)' :
    totalBytes < 500 * 1024  ? 'Needs improvement (target <200 KB)' :
    totalBytes < 1024 * 1024 ? 'Large (>500 KB)' :
                               'Very large (>1 MB)';

  return {
    name: AUDIT_NAME,
    status,
    score,
    message: `Same-origin JavaScript totals ~${kb} KB${cappedNote}${missingNote} — ${label}.`,
    details: `Scripts checked: ${toCheck.join(', ')}`,
    ...(score < 100 && {
      recommendation:
        'Large JavaScript bundles increase Time to Interactive and hurt Core Web Vitals. ' +
        'Use code splitting (dynamic import()), tree-shaking, and lazy loading for non-critical routes. ' +
        'Target <200 KB of initial JS; defer the rest until after the page is interactive.',
    }),
  };
};
