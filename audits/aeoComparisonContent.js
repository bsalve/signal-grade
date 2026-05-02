'use strict';

const AUDIT_NAME = '[AEO] Comparison Content';

const HEADING_RE = /\b(vs\.?|versus|compared (to|with)|differences? between|pros? (and|&|vs\.?) cons?|alternatives? to)\b/i;
const BODY_RE    = /\b(vs\.?|versus|compared (to|with)|side[- ]by[- ]side|better than|worse than|pros? (and|&) cons?)\b/gi;

module.exports = function ($) {
  // Check headings
  const headingMatches = [];
  $('h1,h2,h3,h4').each((_, el) => {
    const text = $(el).text().trim();
    if (HEADING_RE.test(text)) headingMatches.push(text);
  });
  const hasComparisonHeading = headingMatches.length > 0;

  // Check tables with ≥2 columns
  let hasComparisonTable = false;
  $('table').each((_, el) => {
    const thCount = $(el).find('th').length;
    if (thCount >= 2) { hasComparisonTable = true; return false; }
    const firstRowCells = $(el).find('tr').first().find('td').length;
    if (firstRowCells >= 2) { hasComparisonTable = true; return false; }
  });

  // Check body text
  const bodyText = $('body').clone()
    .find('nav,header,footer,script,style,noscript,[role="navigation"]').remove().end()
    .text();
  const bodyMatches = bodyText.match(BODY_RE) || [];
  const bodyMatchCount = bodyMatches.length;

  // Score
  let score, status, message;
  const signals = [];

  if (hasComparisonHeading) signals.push(...headingMatches.slice(0, 2).map(h => `Heading: "${h}"`));
  if (hasComparisonTable) signals.push('Multi-column comparison table');
  if (bodyMatchCount > 0) signals.push(`Body phrases: ${[...new Set(bodyMatches.map(m => m.toLowerCase()))].slice(0, 2).join(', ')}`);

  if (hasComparisonHeading && hasComparisonTable) {
    score = 100; status = 'pass';
    message = 'Strong comparison content: comparison heading and multi-column table detected.';
  } else if (hasComparisonHeading || (hasComparisonTable && bodyMatchCount > 0)) {
    score = 80; status = 'pass';
    message = hasComparisonHeading
      ? 'Comparison heading detected. Consider adding a comparison table for stronger AI citation signals.'
      : 'Comparison table and body phrases detected.';
  } else if (bodyMatchCount >= 2) {
    score = 60; status = 'warn';
    message = `${bodyMatchCount} comparison phrase(s) found in body text but no comparison heading or structured table.`;
  } else if (bodyMatchCount === 1) {
    score = 40; status = 'warn';
    message = '1 comparison phrase found. Add a dedicated comparison section or table to strengthen this signal.';
  } else {
    score = 0; status = 'fail';
    message = 'No comparison content detected.';
  }

  return {
    name: AUDIT_NAME,
    status,
    score,
    message,
    details: signals.length ? signals.join(' | ') : undefined,
    recommendation: score < 80
      ? 'Add a "X vs Y" heading, a side-by-side comparison table, or a pros/cons section. Comparison content is among the most-cited by AI answer engines.'
      : undefined,
  };
};
