function contentBrandConsistency($, html, url) {
  // 1. Try to extract brand name from JSON-LD Organization/LocalBusiness
  let brandName = '';
  $('script[type="application/ld+json"]').each((_, el) => {
    if (brandName) return;
    try {
      const data = JSON.parse($(el).html());
      const entries = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        const type = entry['@type'] || '';
        if (['Organization', 'LocalBusiness', 'Corporation', 'Store', 'Restaurant'].some(t => type.includes(t))) {
          if (entry.name) { brandName = entry.name.trim(); break; }
        }
      }
    } catch (_) {}
  });

  // 2. Fallback: og:site_name
  if (!brandName) {
    brandName = ($('meta[property="og:site_name"]').attr('content') || '').trim();
  }

  // 3. Fallback: title tag — text before first |, —, -, or :
  if (!brandName) {
    const title = $('title').first().text().trim();
    const match = title.match(/^(.+?)[\|—\-–:](.*)$/);
    if (match) {
      // Take whichever side is shorter (usually brand name is the shorter part)
      const left = match[1].trim();
      const right = match[2].trim();
      brandName = left.length <= right.length ? left : right;
    }
  }

  if (!brandName) {
    return {
      name: '[Content] Brand Consistency',
      status: 'warn',
      score: 0,
      message: 'Could not determine a brand name to check consistency against.',
      recommendation:
        'Add an Organization or LocalBusiness JSON-LD schema with a "name" field, or set ' +
        '<meta property="og:site_name" content="Your Brand Name">. ' +
        'A clearly declared brand name helps search engines and AI tools correctly identify your entity.',
    };
  }

  const brandLower = brandName.toLowerCase();
  const contains = (text) => text.toLowerCase().includes(brandLower);

  const title     = $('title').first().text().trim();
  const h1        = $('h1').first().text().trim();
  const ogTitle   = ($('meta[property="og:title"]').attr('content') || '').trim();
  const ogSite    = ($('meta[property="og:site_name"]').attr('content') || '').trim();

  let score = 0;
  const found = [], missing = [];

  if (contains(title))   { score += 25; found.push('title tag'); }
  else                     missing.push('title tag');

  if (contains(h1))      { score += 25; found.push('H1'); }
  else                     missing.push('H1');

  if (ogTitle && contains(ogTitle)) { score += 25; found.push('og:title'); }
  else                               missing.push('og:title');

  if (ogSite && contains(ogSite))   { score += 25; found.push('og:site_name'); }
  else                               missing.push('og:site_name');

  const details = `Brand name identified: "${brandName}"`;

  if (score === 100) {
    return {
      name: '[Content] Brand Consistency',
      status: 'pass',
      score: 100,
      message: `Brand name "${brandName}" is consistent across all checked signals.`,
      details,
    };
  }

  return {
    name: '[Content] Brand Consistency',
    status: score >= 50 ? 'warn' : 'fail',
    score,
    message: `Brand name "${brandName}" is missing from: ${missing.join(', ')}.`,
    details: `${details}\n    Present in: ${found.join(', ') || 'none'}`,
    recommendation:
      `Ensure "${brandName}" appears consistently in: ${missing.join(', ')}. ` +
      'Consistent brand naming across on-page signals (title, H1, og:title, og:site_name) ' +
      'strengthens entity recognition in both traditional search and AI-generated answers.',
  };
}

module.exports = contentBrandConsistency;
