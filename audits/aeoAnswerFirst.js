'use strict';

const AUDIT_NAME = '[AEO] Answer-First Structure';

module.exports = function ($) {
  let para = null;
  let source = 'body';

  const h1 = $('h1').first();
  if (h1.length) {
    // Try immediate next <p>, then any following <p> (skips intervening divs)
    const nextP = h1.next('p');
    if (nextP.length) {
      para = nextP;
      source = 'after-h1';
    } else {
      const followP = h1.nextAll('p').first();
      if (followP.length) {
        para = followP;
        source = 'after-h1';
      }
    }
  }

  // Fallback: first <p> in body
  if (!para || !para.length) {
    const bodyP = $('body p').first();
    if (bodyP.length) {
      para = bodyP;
      source = 'body-fallback';
    }
  }

  if (!para || !para.length) {
    return {
      name: AUDIT_NAME,
      status: 'fail',
      score: 0,
      message: 'No opening paragraph found on this page.',
      recommendation: 'Add a concise 40–80 word paragraph immediately after the H1 that directly answers the page\'s main topic. This improves featured snippet eligibility.',
    };
  }

  const text = para.text().replace(/\s+/g, ' ').trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const preview = text.length > 120 ? text.slice(0, 120) + '…' : text;
  const sourceNote = source === 'after-h1' ? 'Paragraph found after H1.' : 'No H1 found — using first body paragraph.';

  let score, status, message, recommendation;

  if (words >= 40 && words <= 80) {
    score = 100; status = 'pass';
    message = `Opening paragraph is ${words} words — ideal length for featured snippets.`;
  } else if ((words >= 20 && words < 40) || (words > 80 && words <= 120)) {
    score = 70; status = 'warn';
    message = `Opening paragraph is ${words} words — acceptable but not optimal (target: 40–80 words).`;
    recommendation = words < 40
      ? 'Expand the opening paragraph to 40–80 words for better featured snippet eligibility.'
      : 'Trim the opening paragraph to 40–80 words. Shorter, direct answers are preferred by search engines and AI models.';
  } else {
    score = 40; status = 'warn';
    message = words < 20
      ? `Opening paragraph is only ${words} words — too short to serve as a featured snippet answer.`
      : `Opening paragraph is ${words} words — too long. Aim for 40–80 words.`;
    recommendation = words < 20
      ? 'Write a direct 40–80 word answer as the first paragraph after the H1.'
      : 'Break the opening paragraph into a concise 40–80 word lead, followed by additional detail.';
  }

  return {
    name: AUDIT_NAME,
    status,
    score,
    message,
    details: `${words} words | ${sourceNote} | Preview: "${preview}"`,
    recommendation,
  };
};
