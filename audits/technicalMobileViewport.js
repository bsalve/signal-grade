const AUDIT_NAME = '[Technical] Mobile Viewport';

module.exports = function ($, html, url) {
  const tag = $('meta[name="viewport"]');

  if (!tag.length) {
    return {
      name: AUDIT_NAME,
      status: 'fail',
      score: 0,
      message: 'No <meta name="viewport"> tag found.',
      recommendation:
        'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to your <head>. ' +
        'Google uses mobile-first indexing, so a missing viewport tag means your page will not render ' +
        'correctly on mobile devices, directly hurting both rankings and user experience.',
    };
  }

  const content = (tag.attr('content') || '').toLowerCase();

  if (!content.includes('width=device-width')) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'Viewport tag present but missing width=device-width.',
      details: `Found: content="${tag.attr('content')}"`,
      recommendation:
        'Update the viewport tag to include width=device-width: ' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">. ' +
        'Without this the browser may not scale the page correctly on mobile devices.',
    };
  }

  return {
    name: AUDIT_NAME,
    status: 'pass',
    score: 100,
    message: 'Mobile viewport tag is correctly configured.',
    details: `content="${tag.attr('content')}"`,
  };
};
