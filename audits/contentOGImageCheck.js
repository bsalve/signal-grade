const axios = require('axios');

const AUDIT_NAME = '[Content] OG Image Reachability';

module.exports = async function ($, html, url, meta) {
  const ogImage = $('meta[property="og:image"]').attr('content') || '';

  if (!ogImage) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'No og:image tag found.',
      recommendation:
        'Add <meta property="og:image" content="https://..."> with an absolute URL to a ' +
        '1200×630px image. This controls the thumbnail shown when your page is shared on ' +
        'social media or cited in AI-generated summaries.',
    };
  }

  if (!ogImage.startsWith('http')) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'og:image uses a relative URL — absolute URL required.',
      details: `Value: ${ogImage}`,
      recommendation:
        'Change the og:image to a full absolute URL (e.g. https://example.com/image.jpg). ' +
        'Relative URLs do not resolve correctly when shared on external platforms or parsed by AI crawlers.',
    };
  }

  try {
    const res = await axios.head(ogImage, {
      timeout: 8000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { 'User-Agent': 'SignalGrade/1.0' },
    });

    if (res.status >= 200 && res.status < 300) {
      return {
        name: AUDIT_NAME,
        status: 'pass',
        score: 100,
        message: 'og:image is set and resolves successfully.',
        details: `URL: ${ogImage} (HTTP ${res.status})`,
      };
    }

    return {
      name: AUDIT_NAME,
      status: 'fail',
      score: 0,
      message: `og:image URL returned HTTP ${res.status} — image is broken.`,
      details: `URL: ${ogImage}`,
      recommendation:
        'Fix or replace the og:image URL. A broken image means no thumbnail appears when ' +
        'your page is shared on social platforms.',
    };
  } catch {
    return {
      name: AUDIT_NAME,
      status: 'fail',
      score: 0,
      message: 'og:image URL could not be reached.',
      details: `URL: ${ogImage}`,
      recommendation:
        'Verify the og:image URL is publicly accessible and returns a valid image file.',
    };
  }
};
