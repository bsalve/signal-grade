'use strict';

const AUDIT_NAME = '[AEO] Table Content for AI Citation';

module.exports = function ($) {
  const allTables = $('table').toArray();

  if (allTables.length === 0) {
    return {
      name: AUDIT_NAME,
      status: 'fail',
      score: 0,
      message: 'No HTML tables found on this page.',
      recommendation: 'Add HTML tables with <th> headers for comparison or structured data. Tables are preferentially cited by AI answer engines.',
    };
  }

  const dataTables = allTables.filter(el => $(el).find('th').length > 0);
  const hasCaption = dataTables.some(el => $(el).find('caption').length > 0);

  if (dataTables.length === 0) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 60,
      message: `${allTables.length} table(s) found but none have <th> header cells.`,
      details: 'Tables without <th> headers are treated as layout tables by AI crawlers, not data tables.',
      recommendation: 'Add <th> elements to your table headers so AI engines can understand the column context.',
    };
  }

  const firstTable = dataTables[0];
  const headerExamples = $(firstTable).find('th').toArray()
    .slice(0, 3)
    .map(el => $(el).text().trim())
    .filter(Boolean)
    .join(', ');

  return {
    name: AUDIT_NAME,
    status: 'pass',
    score: 100,
    message: `${dataTables.length} data table(s) with <th> headers found.${hasCaption ? ' <caption> elements present.' : ''}`,
    details: headerExamples ? `Column headers (first table): ${headerExamples}` : undefined,
  };
};
