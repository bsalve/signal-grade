const AUDIT_NAME = '[Technical] X-Robots-Tag';

module.exports = function checkXRobotsTag($, html, url, meta) {
  const headers = meta?.headers ?? {};
  const raw     = headers['x-robots-tag'] || '';

  if (!raw) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'No X-Robots-Tag header — page is indexable by default.',
    };
  }

  const val = raw.toLowerCase();

  if (val.includes('noindex') || val === 'none') {
    return {
      name: AUDIT_NAME,
      status: 'fail',
      score: 0,
      message: 'X-Robots-Tag is blocking indexing.',
      details: `Value: ${raw}`,
      recommendation:
        'The X-Robots-Tag: noindex header tells search engines not to index this page. ' +
        'If this is unintentional, remove the header from your server configuration. ' +
        'Note: this header takes precedence over meta robots tags and applies to all crawlers.',
    };
  }

  // Header present but not noindex — unusual, worth flagging
  return {
    name: AUDIT_NAME,
    status: 'warn',
    score: 70,
    message: 'X-Robots-Tag header found — verify directives are intentional.',
    details: `Value: ${raw}`,
    recommendation:
      'The X-Robots-Tag header can restrict crawling and indexing. ' +
      'Verify the directive is intentional and correctly scoped. ' +
      'Common valid values: "all", "index, follow", "nofollow".',
  };
};
