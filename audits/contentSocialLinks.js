'use strict';

const PLATFORMS = {
  'facebook.com':  'Facebook',
  'instagram.com': 'Instagram',
  'linkedin.com':  'LinkedIn',
  'twitter.com':   'Twitter/X',
  'x.com':         'Twitter/X',
  'youtube.com':   'YouTube',
  'tiktok.com':    'TikTok',
  'pinterest.com': 'Pinterest',
};

function contentSocialLinksAudit($, html) {
  const found = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    try {
      const { hostname } = new URL(href);
      const host = hostname.replace(/^www\./, '');
      if (PLATFORMS[host]) {
        found.add(PLATFORMS[host]);
      }
    } catch {
      // relative or malformed URL — skip
    }
  });

  const platforms = [...found].sort();
  const count = platforms.length;

  if (count === 0) {
    return {
      name: '[Content] Social Media Links',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No social media profile links found on this page.',
      recommendation:
        'Add visible links to your social media profiles (Facebook, Instagram, LinkedIn, etc.). ' +
        'Social links reinforce brand presence, support entity association in AI knowledge graphs, ' +
        'and give visitors another way to engage with your business.',
    };
  }

  let score, status;
  if (count === 1)     { score = 40; status = 'warn'; }
  else if (count === 2){ score = 70; status = 'warn'; }
  else if (count <= 4) { score = 90; status = 'pass'; }
  else                 { score = 100; status = 'pass'; }

  const detail = `Found: ${platforms.join(', ')}`;

  return {
    name: '[Content] Social Media Links',
    status,
    score,
    maxScore: 100,
    message: `${count} social media platform${count === 1 ? '' : 's'} linked: ${platforms.join(', ')}.`,
    details: detail,
    recommendation:
      count < 3
        ? 'Consider adding links to more social platforms. Linking to at least 3–4 active profiles ' +
          'strengthens your brand footprint and helps AI engines associate your website with your ' +
          'broader online presence.'
        : undefined,
  };
}

module.exports = contentSocialLinksAudit;
