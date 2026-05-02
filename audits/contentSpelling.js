'use strict';

// Grammar and spell check via LanguageTool public API.
// Free tier: up to 20 req/min, no key required.
// Skipped in site crawl (too slow at scale — listed in SKIP_AUDITS).

async function contentSpellingAudit($, html, url) {
  // Extract body text, strip excess whitespace
  const bodyText = $('body').clone()
    .find('script,style,noscript').remove().end()
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000); // cap at 5000 chars for API limit

  if (bodyText.length < 50) {
    return {
      name: '[Content] Spelling & Grammar',
      status: 'warn',
      score: 50,
      maxScore: 100,
      message: 'Not enough body text to check spelling.',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text: bodyText, language: 'en-US' }).toString(),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        name: '[Content] Spelling & Grammar',
        status: 'warn',
        score: 50,
        maxScore: 100,
        message: 'Could not reach spelling check API.',
      };
    }

    const data = await res.json();
    const matches = data.matches || [];
    const errorCount = matches.length;

    let score;
    if (errorCount === 0) score = 100;
    else if (errorCount < 3) score = 80;
    else if (errorCount < 10) score = 50;
    else score = 0;

    const status = score >= 80 ? 'pass' : score >= 50 ? 'warn' : 'fail';

    const top5 = matches.slice(0, 5).map(m => {
      const context = m.context?.text?.slice(
        Math.max(0, m.context.offset - 10),
        m.context.offset + m.context.length + 20
      ) || '';
      return `"${context.trim()}" — ${m.message}`;
    });

    return {
      name: '[Content] Spelling & Grammar',
      status,
      score,
      maxScore: 100,
      message: errorCount === 0
        ? 'No spelling or grammar issues found'
        : `${errorCount} spelling/grammar issue${errorCount !== 1 ? 's' : ''} detected`,
      details: top5.length ? top5.join('\n') : undefined,
      recommendation: score < 80
        ? 'Spelling and grammar errors undermine credibility and can affect rankings. ' +
          'Run your content through a grammar checker and correct the flagged issues before publishing.'
        : null,
    };
  } catch {
    return {
      name: '[Content] Spelling & Grammar',
      status: 'warn',
      score: 50,
      maxScore: 100,
      message: 'Spelling check timed out or was unavailable.',
    };
  }
}

module.exports = contentSpellingAudit;
