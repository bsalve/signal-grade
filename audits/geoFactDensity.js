'use strict';

const AUDIT_NAME = '[GEO] Fact Density';

const YEAR_RE        = /\b(19|20)\d{2}\b/g;
const PERCENT_RE     = /\d+(\.\d+)?%/g;
const COUNT_RE       = /\b\d[\d,]*\s*(respondents?|participants?|users?|customers?|companies|countries|studies|cases)\b/gi;
const DATE_RE        = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(19|20)\d{2}\b|\bQ[1-4]\s+(19|20)\d{2}\b/gi;
const ATTRIBUTION_RE = /\b(according to|study shows?|research (found|shows?|suggests?)|survey (found|reveals?)|data shows?|analysts? (say|note|found|report))\b/gi;

function countMatches(text, re) {
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

module.exports = function checkFactDensity($) {
  const $body = $('body').clone();
  $body.find('script, style, nav, header, footer, aside, noscript').remove();
  const text  = $body.text().replace(/\s+/g, ' ').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount < 50) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      maxScore: 100,
      message: `Too little text to assess fact density (${wordCount} words).`,
    };
  }

  const signals =
    countMatches(text, YEAR_RE) +
    countMatches(text, PERCENT_RE) +
    countMatches(text, COUNT_RE) +
    countMatches(text, DATE_RE) +
    countMatches(text, ATTRIBUTION_RE);

  const per100        = (signals / wordCount) * 100;
  const per100Rounded = Math.round(per100 * 10) / 10;

  const score  = per100 >= 8 ? 100 : per100 >= 5 ? 70 : per100 >= 3 ? 40 : 0;
  const status = per100 >= 5 ? 'pass' : per100 >= 3 ? 'warn' : 'fail';

  return {
    name: AUDIT_NAME,
    status,
    score,
    maxScore: 100,
    message:
      per100 >= 8
        ? `High fact density (${per100Rounded} signals/100 words) — excellent for AI citation.`
        : per100 >= 5
        ? `Good fact density (${per100Rounded} signals/100 words).`
        : per100 >= 3
        ? `Moderate fact density (${per100Rounded} signals/100 words) — add more specific data points.`
        : `Low fact density (${per100Rounded} signals/100 words) — content lacks verifiable specifics.`,
    details: `Words: ${wordCount} | Fact signals: ${signals} | Density: ${per100Rounded}/100 words`,
    ...(per100 < 5 && {
      recommendation:
        'AI models favor content with specific, verifiable facts. ' +
        'Add data points like "43% of customers...", "according to a 2024 survey...", "founded in 2018", or "1,200 respondents". ' +
        'Reference specific years, quantities, dates, and attributed claims rather than vague generalities.',
    }),
  };
};
