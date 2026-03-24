function headingsAudit($) {
  const h1s = $('h1');

  if (h1s.length === 0) {
    return {
      name: 'H1 Heading',
      status: 'fail',
      message: 'No H1 heading found on the page.',
    };
  }

  if (h1s.length > 1) {
    return {
      name: 'H1 Heading',
      status: 'warn',
      message: `Multiple H1 headings found (${h1s.length}). Best practice is one H1 per page.`,
      details: h1s.map((_, el) => $(el).text().trim()).get().join(' | '),
    };
  }

  const h1Text = h1s.first().text().trim();
  return {
    name: 'H1 Heading',
    status: 'pass',
    message: 'Exactly one H1 heading found.',
    details: h1Text,
  };
}

module.exports = headingsAudit;
