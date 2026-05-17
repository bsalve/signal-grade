'use strict';

// Generic anchor text hurts SEO: "click here", "read more", etc. give search engines
// no signal about the linked page's topic. Each anchor should describe its destination.

const GENERIC_ANCHORS = new Set([
  'click here', 'click', 'here', 'read more', 'read', 'more', 'learn more',
  'this', 'this link', 'this page', 'link', 'page', 'website', 'site',
  'info', 'information', 'details', 'see more', 'see here', 'go here',
  'continue', 'continue reading', 'find out more', 'download', 'view',
]);

module.exports = function contentAnchorTextAudit($) {
  const anchors = $('a[href]');
  if (anchors.length === 0) {
    return {
      name: '[Content] Anchor Text Quality',
      status: 'warn',
      score: 50,
      maxScore: 100,
      message: 'No links found on this page.',
    };
  }

  const generic = [];
  anchors.each((_, el) => {
    const $el = $(el);
    // Skip links that only contain an image
    if ($el.find('img').length && !$el.text().trim()) return;
    const text = $el.text().replace(/\s+/g, ' ').trim().toLowerCase();
    if (text && GENERIC_ANCHORS.has(text)) {
      generic.push(text);
    }
  });

  const count = generic.length;

  let score, status;
  if (count === 0)       { score = 100; status = 'pass'; }
  else if (count <= 2)   { score = 70;  status = 'warn'; }
  else if (count <= 5)   { score = 40;  status = 'warn'; }
  else                   { score = 0;   status = 'fail'; }

  const uniqueGeneric = [...new Set(generic)].slice(0, 5);

  return {
    name: '[Content] Anchor Text Quality',
    status,
    score,
    maxScore: 100,
    message: count === 0
      ? 'All links use descriptive anchor text.'
      : `${count} link${count !== 1 ? 's use' : ' uses'} generic anchor text (e.g. "${uniqueGeneric[0]}")`,
    details: count > 0 ? `Generic anchors found: ${uniqueGeneric.map(t => `"${t}"`).join(', ')}` : undefined,
    recommendation: count > 0
      ? 'Replace generic anchor text like "click here" or "read more" with descriptive phrases ' +
        'that tell both users and search engines what the linked page is about. ' +
        'For example: "View our pricing plans" instead of "click here".'
      : null,
  };
};
