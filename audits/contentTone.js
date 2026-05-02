'use strict';

const AUDIT_NAME = '[Content] Passive Voice & Tone';

const PASSIVE_RE = /\b(am|is|are|was|were|be|been|being)\s+(\w+ed|built|done|found|given|gone|known|made|put|seen|set|shown|taken|told|written)\b/i;

module.exports = function ($) {
  const bodyText = $('body').clone()
    .find('script,style,nav,header,footer,aside,noscript,[role="navigation"]').remove().end()
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  // Split on punctuation followed by whitespace; discard fragments < 3 words
  // (short fragments are usually abbreviation artifacts, e.g. "Dr." or "e.g.")
  const sentences = bodyText.split(/[.!?]+\s+/)
    .map(s => s.trim())
    .filter(s => s.split(/\s+/).filter(Boolean).length >= 3);
  const totalSentences = sentences.length;

  if (totalSentences < 5) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'Not enough body text to analyze tone.',
      recommendation: 'Add more body content (at least 5 sentences) to enable tone analysis.',
    };
  }

  const passiveSentences = sentences.filter(s => PASSIVE_RE.test(s));
  const passiveCount = passiveSentences.length;
  const ratio = passiveCount / totalSentences;
  const pct = Math.round(ratio * 100);

  let score, status, message, recommendation;

  if (ratio < 0.10) {
    score = 100; status = 'pass';
    message = `Active voice dominates: ${pct}% passive sentences (${passiveCount}/${totalSentences}).`;
  } else if (ratio < 0.20) {
    score = 70; status = 'warn';
    message = `Moderate passive voice: ${pct}% of sentences (${passiveCount}/${totalSentences}).`;
    recommendation = 'Rewrite passive sentences to active voice where possible. Active voice is more authoritative and preferred by AI citation systems.';
  } else if (ratio < 0.35) {
    score = 40; status = 'warn';
    message = `High passive voice usage: ${pct}% of sentences (${passiveCount}/${totalSentences}).`;
    recommendation = 'Significant passive voice detected. Rewriting to active voice improves readability scores and signals authoritative content to AI models.';
  } else {
    score = 0; status = 'fail';
    message = `Very high passive voice: ${pct}% of sentences (${passiveCount}/${totalSentences}). Content reads as weak or evasive.`;
    recommendation = 'Rewrite content in active voice throughout. Passive constructions above 35% correlate with lower readability and reduced AI citation rates.';
  }

  const examples = passiveSentences
    .slice(0, 3)
    .map(s => `"${s.length > 80 ? s.slice(0, 80) + '…' : s}"`);

  return {
    name: AUDIT_NAME,
    status,
    score,
    message,
    details: examples.length
      ? `Examples: ${examples.join(' | ')}`
      : undefined,
    recommendation,
  };
};
