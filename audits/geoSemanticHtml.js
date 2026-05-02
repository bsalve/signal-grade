'use strict';

const AUDIT_NAME = '[GEO] Semantic HTML Structure';

module.exports = function checkSemanticHtml($) {
  let score = 0;
  const present = [];
  const missing = [];

  // <main> — 20pts
  if ($('main').length > 0) {
    score += 20;
    present.push('<main>');
  } else {
    missing.push('<main> (20pts)');
  }

  // <article> — 20pts
  if ($('article').length > 0) {
    score += 20;
    present.push('<article>');
  } else {
    missing.push('<article> (20pts)');
  }

  // <section> containing a heading — 20pts
  const hasSemanticSection = $('section').toArray().some(
    el => $(el).find('h1, h2, h3, h4, h5, h6').length > 0
  );
  if (hasSemanticSection) {
    score += 20;
    present.push('<section> with heading');
  } else {
    missing.push('<section> with heading (20pts)');
  }

  // <header> AND <footer> both present — 15pts
  const hasHeader = $('header').length > 0;
  const hasFooter = $('footer').length > 0;
  if (hasHeader && hasFooter) {
    score += 15;
    present.push('<header> + <footer>');
  } else {
    // Both required for points — list only the missing element(s)
    if (!hasHeader) missing.push('<header>');
    if (!hasFooter) missing.push('<footer>');
  }

  // <nav> — 15pts
  if ($('nav').length > 0) {
    score += 15;
    present.push('<nav>');
  } else {
    missing.push('<nav> (15pts)');
  }

  // <aside> — 10pts
  if ($('aside').length > 0) {
    score += 10;
    present.push('<aside>');
  } else {
    missing.push('<aside> (10pts)');
  }

  const capped = Math.min(score, 100);
  const status = capped >= 75 ? 'pass' : capped >= 35 ? 'warn' : 'fail';

  const detailParts = [];
  if (present.length) detailParts.push(`Present: ${present.join(', ')}`);
  if (missing.length) detailParts.push(`Missing: ${missing.join(', ')}`);

  return {
    name: AUDIT_NAME,
    status,
    score: capped,
    maxScore: 100,
    message:
      capped >= 75
        ? `Strong semantic HTML structure (${capped}/100) — good AI parsability.`
        : capped >= 35
        ? `Partial semantic HTML structure (${capped}/100) — key landmark elements missing.`
        : `Weak semantic HTML structure (${capped}/100) — AI models cannot identify content regions.`,
    details: detailParts.join(' · ') || undefined,
    recommendation:
      missing.length === 0
        ? undefined
        : 'Semantic HTML elements help AI models identify which page regions contain primary content, navigation, or supplementary material. ' +
          'Wrap your main content in <main>, article content in <article>, navigation links in <nav>, ' +
          'page-level header/footer in <header>/<footer>, and sidebar content in <aside>. ' +
          '<section> elements should contain at least one heading to be meaningful.',
  };
};
