function checkImageAlt($, html, url) {
  const allImgs = $('img');

  if (allImgs.length === 0) {
    return {
      name: '[Content] Image Alt Text',
      status: 'pass',
      message: 'No images found on the page.',
    };
  }

  let total = 0;
  let missing = 0;
  const missingExamples = [];

  allImgs.each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src.startsWith('data:')) return; // skip inline data URIs

    total++;
    const alt = $(el).attr('alt');
    if (alt === undefined) {
      // alt="" (empty string) is intentionally decorative — acceptable
      // No alt attribute at all = missing
      missing++;
      if (missingExamples.length < 5) {
        const name = src.split('/').pop().split('?')[0].slice(0, 60) || 'unknown';
        missingExamples.push(name);
      }
    }
  });

  if (total === 0) {
    return {
      name: '[Content] Image Alt Text',
      status: 'pass',
      message: 'No external images found on the page.',
    };
  }

  const pct = Math.round(((total - missing) / total) * 100);

  if (missing === 0) {
    return {
      name: '[Content] Image Alt Text',
      status: 'pass',
      score: 100,
      message: `All ${total} image(s) have alt attributes.`,
    };
  }

  const status = pct >= 80 ? 'warn' : 'fail';

  return {
    name: '[Content] Image Alt Text',
    status,
    score: pct,
    message: `${missing} of ${total} image(s) are missing alt attributes.`,
    details: `Missing alt on: ${missingExamples.join(', ')}${missing > 5 ? ` (+${missing - 5} more)` : ''}`,
    recommendation:
      'Add descriptive alt text to all images. Alt text improves accessibility for screen reader ' +
      'users and helps search engines understand image content, contributing to image search rankings. ' +
      'Describe the image in 5–15 words. Use alt="" (empty) only for purely decorative images.',
  };
}

module.exports = checkImageAlt;
