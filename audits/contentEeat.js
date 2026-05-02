'use strict';

const AUDIT_NAME = '[Content] E-E-A-T Signals';

const AUTHORITY_RE = /\.(gov|edu)(\/|\?|#|$)|wikipedia\.org/i;

module.exports = function ($) {
  const found = [];
  const missing = [];
  let score = 0;

  // 1. Author byline (25 pts)
  const hasAuthor = $('[rel="author"], [itemprop="author"], [data-author]').length > 0
    || $('[class*="author"]').length > 0;
  if (hasAuthor) { score += 25; found.push('Author byline'); }
  else missing.push('Author byline');

  // Collect all link hrefs once for reuse across checks 2–5
  const linkHrefs = $('a[href]').toArray().map(el => $(el).attr('href') || '');

  // 2. About page link (15 pts)
  const hasAbout = linkHrefs.some(h => /\/about([-\/]|$)/i.test(h));
  if (hasAbout) { score += 15; found.push('About page link'); }
  else missing.push('About page link');

  // 3. Contact page link (15 pts)
  const hasContact = linkHrefs.some(h => /\/contact([-\/]|$)/i.test(h));
  if (hasContact) { score += 15; found.push('Contact page link'); }
  else missing.push('Contact page link');

  // 4. Privacy AND Terms links (15 pts — must have both)
  const hasPrivacy = linkHrefs.some(h => /privacy/i.test(h));
  const hasTerms   = linkHrefs.some(h => /terms/i.test(h));
  if (hasPrivacy && hasTerms) { score += 15; found.push('Privacy & Terms links'); }
  else missing.push('Privacy & Terms links');

  // 5. External citations / authority links (15 pts)
  const hasCitation = $('cite').length > 0
    || linkHrefs.some(h => AUTHORITY_RE.test(h));
  if (hasCitation) { score += 15; found.push('External citations or authority links'); }
  else missing.push('External citations or authority links');

  // 6. Review or testimonial content (15 pts)
  const hasReview = $('[itemprop="review"]').length > 0
    || $('[class*="testimonial"], [class*="review"]').length > 0
    || $('blockquote').toArray().some(el => {
      const words = $(el).text().trim().split(/\s+/).filter(Boolean).length;
      return words >= 20;
    });
  if (hasReview) { score += 15; found.push('Reviews or testimonials'); }
  else missing.push('Reviews or testimonials');

  const status = score >= 75 ? 'pass' : score >= 40 ? 'warn' : 'fail';

  const parts = [];
  if (found.length) parts.push(`Found: ${found.join(', ')}`);
  if (missing.length) parts.push(`Missing: ${missing.join(', ')}`);

  return {
    name: AUDIT_NAME,
    status,
    score,
    message: `${found.length} of 6 E-E-A-T signals present.`,
    details: parts.join(' | '),
    recommendation: missing.length
      ? `Add missing signals: ${missing.slice(0, 3).join(', ')}. E-E-A-T signals build trust with both Google's quality raters and AI citation systems.`
      : undefined,
  };
};
