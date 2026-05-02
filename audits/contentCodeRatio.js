'use strict';

const AUDIT_NAME = '[Content] Content-to-Code Ratio';

module.exports = function ($, html) {
  const htmlBytes = Buffer.byteLength(html || '', 'utf8');

  if (htmlBytes === 0) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'Could not measure page size.',
    };
  }

  const bodyText = $('body').clone()
    .find('script,style,noscript').remove().end()
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  const textChars = bodyText.length;
  const ratio = textChars / htmlBytes;

  let score, status, message;

  if (ratio >= 0.25) {
    score = 100; status = 'pass';
    message = `Good content-to-code ratio (${(ratio * 100).toFixed(1)}%).`;
  } else if (ratio >= 0.15) {
    score = 70; status = 'warn';
    message = `Moderate content-to-code ratio (${(ratio * 100).toFixed(1)}%). Consider reducing markup bloat.`;
  } else if (ratio >= 0.08) {
    score = 40; status = 'warn';
    message = `Low content-to-code ratio (${(ratio * 100).toFixed(1)}%). Excess markup may impede AI content parsing.`;
  } else {
    score = 0; status = 'fail';
    message = `Very low content-to-code ratio (${(ratio * 100).toFixed(1)}%). The page is mostly markup with little readable content.`;
  }

  return {
    name: AUDIT_NAME,
    status,
    score,
    message,
    details: `Text: ${textChars.toLocaleString()} chars | HTML: ${htmlBytes.toLocaleString()} bytes | Ratio: ${(ratio * 100).toFixed(1)}%`,
    recommendation: ratio < 0.15
      ? 'Reduce inline scripts, excessive wrapper divs, and hidden markup. Ensure the page\'s primary content is in visible HTML text, not loaded via JavaScript.'
      : undefined,
  };
};
