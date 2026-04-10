function contentHeadingHierarchy($, html, url) {
  // Collect all headings in DOM order
  const headings = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    headings.push(parseInt(el.tagName.slice(1), 10));
  });

  const h2s = headings.filter(h => h === 2);
  const h3s = headings.filter(h => h === 3);

  if (headings.length === 0) {
    return {
      name: '[Content] Heading Hierarchy',
      status: 'fail',
      message: 'No headings found on the page.',
      recommendation:
        'Add a logical heading structure: one H1 for the page title, H2s for major sections, ' +
        'and H3s for subsections under H2s. A clear hierarchy helps search engines understand ' +
        'page structure and improves accessibility.',
    };
  }

  // Check if H3 appears before the first H2
  if (h3s.length > 0 && h2s.length === 0) {
    return {
      name: '[Content] Heading Hierarchy',
      status: 'fail',
      message: 'H3 headings are present but no H2 exists — heading levels are skipped.',
      details: `Heading levels found: ${[...new Set(headings)].map(h => 'H' + h).join(', ')}`,
      recommendation:
        'Do not skip heading levels. H3 should only be used under H2. Add H2 section headings ' +
        'to create a proper outline before using H3 subheadings.',
    };
  }

  // Check ordering: find first H3 position vs first H2 position
  const firstH2idx = headings.indexOf(2);
  const firstH3idx = headings.indexOf(3);
  if (firstH3idx !== -1 && firstH2idx !== -1 && firstH3idx < firstH2idx) {
    return {
      name: '[Content] Heading Hierarchy',
      status: 'fail',
      message: 'An H3 appears before the first H2 — heading levels are out of order.',
      details: `Heading order: ${headings.slice(0, 10).map(h => 'H' + h).join(' → ')}`,
      recommendation:
        'Restructure headings so H2 sections always precede H3 subsections. ' +
        'Search engines and screen readers use heading order to build a document outline.',
    };
  }

  if (h2s.length === 0) {
    return {
      name: '[Content] Heading Hierarchy',
      status: 'warn',
      message: 'No H2 headings found — consider adding section headings.',
      details: `Heading levels found: ${[...new Set(headings)].map(h => 'H' + h).join(', ')}`,
      recommendation:
        'Add H2 headings to break the page into named sections. H2s act as signposts for ' +
        'both users and search engines and are frequently used in featured snippet extraction.',
    };
  }

  return {
    name: '[Content] Heading Hierarchy',
    status: 'pass',
    message: `Heading hierarchy is valid — H1, ${h2s.length} H2(s)${h3s.length ? ', ' + h3s.length + ' H3(s)' : ''} in correct order.`,
    details: `Heading levels: ${[...new Set(headings)].map(h => 'H' + h).join(', ')}`,
  };
}

module.exports = contentHeadingHierarchy;
