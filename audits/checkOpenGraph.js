function checkOpenGraph($, html, url) {
  const getMeta = (prop) =>
    ($(`meta[property="${prop}"]`).attr('content') ||
     $(`meta[name="${prop}"]`).attr('content') ||
     '').trim();

  const title       = getMeta('og:title');
  const description = getMeta('og:description');
  const image       = getMeta('og:image');
  const ogUrl       = getMeta('og:url');
  const twitterCard = getMeta('twitter:card');

  let score = 0;
  const found   = [];
  const missing = [];

  if (title)       { score += 25; found.push(`og:title: "${title.slice(0, 60)}${title.length > 60 ? '…' : ''}"`); }
  else               missing.push('og:title');

  if (description) { score += 25; found.push(`og:description: "${description.slice(0, 60)}${description.length > 60 ? '…' : ''}"`); }
  else               missing.push('og:description');

  if (image)       { score += 30; found.push(`og:image: ${image}`); }
  else               missing.push('og:image');

  if (ogUrl)       { score += 10; found.push(`og:url: ${ogUrl}`); }
  else               missing.push('og:url');

  if (twitterCard) { score += 10; found.push(`twitter:card: ${twitterCard}`); }
  else               missing.push('twitter:card');

  if (score === 0) {
    return {
      name: '[Content] Open Graph & Social Tags',
      status: 'fail',
      score: 0,
      message: 'No Open Graph or Twitter Card tags found.',
      recommendation:
        'Add Open Graph meta tags to control how your page appears when shared on social media ' +
        'and linked in AI chat tools. Minimum: og:title, og:description, og:image, og:url. ' +
        'Example: <meta property="og:title" content="Page Title">',
    };
  }

  if (missing.length > 0) {
    return {
      name: '[Content] Open Graph & Social Tags',
      status: score >= 50 ? 'warn' : 'fail',
      score,
      message: `Open Graph tags partially set — missing: ${missing.join(', ')}.`,
      details: found.join('\n    '),
      recommendation:
        `Add the missing tags: ${missing.join(', ')}. ` +
        'og:image is particularly important — pages without an image are often skipped when shared.',
    };
  }

  return {
    name: '[Content] Open Graph & Social Tags',
    status: 'pass',
    score: 100,
    message: 'All Open Graph and Twitter Card tags are present.',
    details: found.join('\n    '),
  };
}

module.exports = checkOpenGraph;
