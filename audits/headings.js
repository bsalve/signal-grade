function headingsAudit($) {
  const h1s = $('h1');

  if (h1s.length === 0) {
    return {
      name: '[Content] H1 Heading',
      status: 'fail',
      message: 'No H1 heading found on the page.',
      recommendation: 'Add exactly one H1 heading that includes your primary keyword and describes what the page is about. It is the strongest on-page signal to search engines about your page topic.',
    };
  }

  if (h1s.length > 1) {
    return {
      name: '[Content] H1 Heading',
      status: 'warn',
      message: `Multiple H1 headings found (${h1s.length}). Best practice is one H1 per page.`,
      details: h1s.map((_, el) => $(el).text().trim()).get().join(' | '),
      recommendation: 'Keep only one H1 — the most descriptive one. Demote the others to H2 or H3. Multiple H1s dilute your page\'s topical focus and can confuse search engines about the primary subject.',
    };
  }

  const h1Text = h1s.first().text().trim();
  return {
    name: '[Content] H1 Heading',
    status: 'pass',
    message: 'Exactly one H1 heading found.',
    details: h1Text,
  };
}

module.exports = headingsAudit;
