'use strict';

const AUDIT_NAME = '[GEO] AI Citation Signals';

// Match .gov/.edu TLDs followed by path delimiter (not end-of-string, since hrefs include paths)
const AUTHORITY_DOMAINS = /\.(gov|edu)[\/\?#]|wikipedia\.org|arxiv\.org|pubmed\.ncbi\.nlm\.nih\.gov/i;
const ORIGINAL_RESEARCH_RE = /\b(our research|we surveyed|we studied|we analyzed|our study|our data|our findings|we found that|N\s*=\s*\d+|\d+\s*respondents|\d+\s*participants)\b/i;

module.exports = function checkAiCitationSignals($, html) {
  let score = 0;
  const signals = [];

  // Signal 1: <blockquote cite="http..."> with valid URL (20pts)
  let hasCiteBlockquote = false;
  $('blockquote[cite]').each((_, el) => {
    const cite = $(el).attr('cite') || '';
    if (cite.startsWith('http')) { hasCiteBlockquote = true; return false; }
  });
  if (hasCiteBlockquote) { score += 20; signals.push('<blockquote cite="URL">'); }

  // Signal 2: <cite> elements present (15pts)
  if ($('cite').length > 0) { score += 15; signals.push('<cite> elements'); }

  // Signal 3: inline numbered citations [1] or footnote/references section heading (20pts)
  const bodyText = $('body').text();
  const hasInlineCitations = /\[\d+\]/.test(bodyText);
  const hasFootnoteSection  = $('h1,h2,h3,h4,h5,h6').toArray().some(el =>
    /\b(references?|footnotes?|citations?|sources?|bibliography)\b/i.test($(el).text())
  );
  if (hasInlineCitations || hasFootnoteSection) {
    score += 20;
    signals.push(hasInlineCitations ? 'inline numeric citations [N]' : 'footnote/references section heading');
  }

  // Signal 4: original research phrases (25pts)
  if (ORIGINAL_RESEARCH_RE.test(bodyText)) {
    score += 25;
    signals.push('original research phrases');
  }

  // Signal 5: links to .gov/.edu/Wikipedia/academic sources (20pts)
  let hasAuthorityLinks = false;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.startsWith('http') && AUTHORITY_DOMAINS.test(href)) {
      hasAuthorityLinks = true;
      return false; // break
    }
  });
  if (hasAuthorityLinks) { score += 20; signals.push('links to .gov/.edu/Wikipedia/academic sources'); }

  const capped = Math.min(score, 100);
  const status = capped >= 75 ? 'pass' : capped >= 40 ? 'warn' : 'fail';

  return {
    name: AUDIT_NAME,
    status,
    score: capped,
    maxScore: 100,
    message:
      capped >= 75
        ? `Strong AI citation signals (${capped}/100) — content is well-positioned for AI attribution.`
        : capped >= 40
        ? `Moderate AI citation signals (${capped}/100) — some credibility markers present.`
        : `Weak AI citation signals (${capped}/100) — content lacks markers that AI systems use to evaluate citeworthiness.`,
    details: signals.length > 0 ? `Signals: ${signals.join(', ')}` : 'No citation signals detected.',
    recommendation:
      capped < 75
        ? 'AI systems preferentially cite pages that demonstrate clear sourcing and original research. ' +
          'Add: numbered citations ([1], [2]) with a References section, ' +
          '<blockquote cite="URL"> for quoted external content, ' +
          '<cite> tags for author/publication attribution, ' +
          'links to authoritative sources (.gov, .edu, Wikipedia), ' +
          'and original data ("we surveyed 500 customers...") for maximum citeworthiness.'
        : undefined,
  };
};
