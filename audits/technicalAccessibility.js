const AUDIT_NAME = '[Technical] Accessibility Signals';

module.exports = function ($, html, url) {
  let score = 0;
  const issues = [];
  const passes = [];

  // 1. lang attribute on <html> (30 pts)
  const lang = $('html').attr('lang');
  if (lang && lang.trim().length > 0) {
    score += 30;
    passes.push('lang attribute present on <html>');
  } else {
    issues.push('Missing lang attribute on <html> — screen readers cannot determine page language');
  }

  // 2. <main> landmark or role="main" (25 pts)
  const hasMain = $('main').length > 0 || $('[role="main"]').length > 0;
  if (hasMain) {
    score += 25;
    passes.push('<main> landmark present');
  } else {
    issues.push('No <main> landmark or role="main" — assistive technologies cannot identify main content');
  }

  // 3. Form inputs have associated labels (25 pts)
  // Only check interactive inputs (exclude hidden/button types)
  const inputTypes = ['text', 'email', 'password', 'tel', 'number', 'search', 'url', 'date',
                      'time', 'checkbox', 'radio', 'file', 'textarea'];
  const inputs = $('input, textarea, select').filter((_, el) => {
    const type = ($(el).attr('type') || 'text').toLowerCase();
    return !['hidden', 'submit', 'button', 'reset', 'image'].includes(type);
  });

  if (inputs.length === 0) {
    // No interactive inputs — full marks (not applicable)
    score += 25;
    passes.push('No interactive form inputs found');
  } else {
    const unlabeled = inputs.filter((_, el) => {
      const id = $(el).attr('id');
      const hasLabel = id && $(`label[for="${id}"]`).length > 0;
      const hasAriaLabel = $(el).attr('aria-label') || $(el).attr('aria-labelledby');
      const wrappedInLabel = $(el).closest('label').length > 0;
      return !hasLabel && !hasAriaLabel && !wrappedInLabel;
    });
    if (unlabeled.length === 0) {
      score += 25;
      passes.push(`All ${inputs.length} form input${inputs.length !== 1 ? 's have' : ' has'} an associated label`);
    } else {
      issues.push(`${unlabeled.length} of ${inputs.length} form input${inputs.length !== 1 ? 's are' : ' is'} missing a label or aria-label`);
    }
  }

  // 4. Skip navigation link (20 pts)
  // An <a> pointing to an anchor like #main, #content, #skip, etc.
  const SKIP_TARGETS = /^#(main|content|skip|primary|nav-skip|skip-nav|maincontent|main-content)$/i;
  const hasSkipNav = $('a[href]').filter((_, el) => SKIP_TARGETS.test($(el).attr('href') || '')).length > 0;
  if (hasSkipNav) {
    score += 20;
    passes.push('Skip navigation link present');
  } else {
    issues.push('No skip navigation link — keyboard users must tab through all navigation on every page');
  }

  const cappedScore = Math.min(score, 100);
  const status = cappedScore === 100 ? 'pass' : cappedScore >= 50 ? 'warn' : 'fail';

  const details = [
    passes.map(p => `✓ ${p}`).join('\n'),
    issues.map(i => `✗ ${i}`).join('\n'),
  ].filter(Boolean).join('\n');

  return {
    name: AUDIT_NAME,
    status,
    score: cappedScore,
    message: issues.length === 0
      ? 'All checked accessibility signals are present.'
      : `${issues.length} accessibility signal${issues.length !== 1 ? 's' : ''} missing.`,
    details,
    recommendation: issues.length > 0
      ? 'Fix the flagged accessibility signals to improve usability for screen reader and keyboard users. ' +
        'These are among the most impactful static-HTML accessibility improvements: lang attribute, ' +
        'a <main> landmark, labeled form inputs, and a skip-navigation link.'
      : undefined,
  };
};
