const AUDIT_NAME = '[Content] Keyword Frequency';

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','up','about','into','through','during','is','are','was','were','be',
  'been','being','have','has','had','do','does','did','will','would','shall',
  'should','may','might','must','can','could','it','its','this','that','these',
  'those','i','you','he','she','we','they','what','which','who','how','all',
  'each','every','both','few','more','most','other','some','such','no','not',
  'only','same','so','than','too','very','just','as','if','then','there','when',
  'where','while','our','your','their','his','her','us','my','me','him','them',
  'am','any','one','two','three','also','s','t','re','ll','ve','d','m','get',
  'got','get','page','click','here','read','learn','find','see','use','using',
]);

module.exports = function ($, html, url) {
  // Clone body to avoid mutating the shared DOM
  const bodyClone = $('body').clone();
  bodyClone.find('nav, footer, header, script, style, noscript').remove();
  const text = bodyClone.text();

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w) && !/^-+$/.test(w));

  if (words.length < 50) {
    return {
      name: AUDIT_NAME,
      status: 'fail',
      score: 0,
      message: 'Too few meaningful words to analyze keyword frequency.',
      recommendation:
        'Add more substantive body content. Pages with fewer than 50 meaningful words provide ' +
        'very little topical signal to search engines and AI crawlers.',
    };
  }

  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;

  const top = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([w, c]) => `${w} (${c})`);

  const score = words.length >= 200 ? 100 : 60;

  return {
    name: AUDIT_NAME,
    status: score === 100 ? 'pass' : 'warn',
    score,
    message: score === 100
      ? `Keyword analysis complete — ${words.length} meaningful words found.`
      : `Thin content — only ${words.length} meaningful words detected.`,
    details: `Top keywords: ${top.join(', ')}`,
  };
};
