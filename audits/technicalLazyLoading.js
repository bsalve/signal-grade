const AUDIT_NAME = '[Technical] Image Lazy Loading';

module.exports = function ($, html, url) {
  const allImgs = $('img').toArray();

  if (allImgs.length < 3) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'Fewer than 3 images — lazy loading not applicable.',
    };
  }

  // Skip the first 2 images (likely above-the-fold: logo, hero)
  const applicable = allImgs.slice(2);
  const missing = applicable.filter(el => !$(el).attr('loading'));
  const total = applicable.length;
  const pct = Math.round(((total - missing.length) / total) * 100);

  if (missing.length === 0) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: `All ${total} applicable image${total > 1 ? 's' : ''} use lazy loading.`,
    };
  }

  const score = pct >= 50 ? 60 : 0;

  return {
    name: AUDIT_NAME,
    status: score >= 60 ? 'warn' : 'fail',
    score,
    message: `${missing.length} of ${total} images missing loading="lazy".`,
    details: `${pct}% of applicable images have lazy loading set.`,
    recommendation:
      'Add loading="lazy" to below-the-fold images: <img src="..." loading="lazy" alt="...">. ' +
      'This defers loading of offscreen images, improving page speed and Core Web Vitals (LCP). ' +
      'Leave the first 1–2 above-the-fold images without it so they load immediately.',
  };
};
