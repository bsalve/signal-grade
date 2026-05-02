'use strict';

const AUDIT_NAME = '[AEO] Q&A Heading Density';

module.exports = function ($) {
  const headings = [];
  $('h2, h3').each((_, el) => {
    if ($(el).closest('nav, header, footer, [role="navigation"]').length) return;
    headings.push($(el).text().trim());
  });

  const totalHeadings = headings.length;

  if (totalHeadings === 0) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'No H2/H3 headings found to analyze.',
      recommendation: 'Add H2 or H3 headings to structure your content. Question-form headings improve AEO and featured snippet eligibility.',
    };
  }

  const questionCount = headings.filter(h => h.endsWith('?')).length;
  const ratio = questionCount / totalHeadings;

  // dt bonus (Q&A definition list pairs), capped at 20 pts
  const dtCount = $('dt').length;
  const dtBonus = Math.min(dtCount * 5, 20);

  let baseScore;
  if (ratio >= 0.5)       baseScore = 80;
  else if (ratio >= 0.25) baseScore = 60;
  else if (ratio >= 0.10) baseScore = 40;
  else if (questionCount > 0) baseScore = 20;
  else baseScore = 0;

  const score = Math.min(baseScore + dtBonus, 100);
  const status = score >= 70 ? 'pass' : score >= 30 ? 'warn' : 'fail';

  const pct = Math.round(ratio * 100);
  const examples = headings.filter(h => h.endsWith('?')).slice(0, 2);

  let message;
  if (questionCount === 0) {
    message = `0 of ${totalHeadings} headings are questions.`;
  } else {
    message = `${questionCount} of ${totalHeadings} headings are questions (${pct}%).`;
  }
  if (dtCount > 0) message += ` ${dtCount} definition list term(s) found.`;

  return {
    name: AUDIT_NAME,
    status,
    score,
    message,
    details: examples.length ? `Question headings: ${examples.map(h => `"${h}"`).join(', ')}` : undefined,
    recommendation: score < 70
      ? `Rephrase more H2/H3 headings as questions (aim for ≥50% of headings). Currently ${pct}%. Question headings align with how users phrase voice and AI search queries.`
      : undefined,
  };
};
