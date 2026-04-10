function contentWordCount($, html, url) {
  // Remove script/style/nav/footer content before counting
  const $clone = $.load($.html());
  $clone('script, style, nav, footer, noscript').remove();
  const text = $clone('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = text ? text.split(' ').filter(w => w.length > 0).length : 0;

  const score = Math.min(Math.round((wordCount / 300) * 100), 100);

  if (wordCount < 100) {
    return {
      name: '[Content] Content Length',
      status: 'fail',
      score,
      message: `Very thin content — only ${wordCount} word(s) detected on this page.`,
      details: `${wordCount} words`,
      recommendation:
        'Add substantive content to this page. Pages with fewer than 300 words are commonly ' +
        'flagged as "thin content" by search engines and are less likely to rank or be cited ' +
        'by AI tools. Aim for at least 300 words of meaningful, original content.',
    };
  }

  if (wordCount < 300) {
    return {
      name: '[Content] Content Length',
      status: 'warn',
      score,
      message: `Content is thin — ${wordCount} words detected. Aim for at least 300.`,
      details: `${wordCount} words`,
      recommendation:
        'Expand the page content. Thin pages (under 300 words) often rank below pages with ' +
        'more comprehensive coverage of the topic. Add context, FAQs, or supporting details ' +
        'to reach a minimum of 300 words.',
    };
  }

  return {
    name: '[Content] Content Length',
    status: 'pass',
    score: 100,
    message: `Content length is sufficient — ${wordCount} words detected.`,
    details: `${wordCount} words`,
  };
}

module.exports = contentWordCount;
