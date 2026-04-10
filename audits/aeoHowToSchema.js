'use strict';

function aeoHowToSchemaAudit($, html) {
  const scripts = $('script[type="application/ld+json"]');

  if (scripts.length === 0) {
    return {
      name: '[AEO] How-To Schema',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No JSON-LD structured data found.',
      recommendation:
        'If you publish instructional or step-by-step content, add HowTo schema. It enables ' +
        'rich results in Google Search and makes your content directly parseable by AI engines ' +
        'as an authoritative answer to "how to" queries.',
    };
  }

  let howToData = null;

  scripts.each((_, el) => {
    if (howToData) return;
    try {
      const data = JSON.parse($(el).html());
      const objects = data['@graph'] ? data['@graph'] : [data];
      for (const obj of objects) {
        const type = obj['@type'];
        const types = Array.isArray(type) ? type : [type];
        if (types.includes('HowTo')) {
          howToData = obj;
          break;
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  if (!howToData) {
    return {
      name: '[AEO] How-To Schema',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No HowTo schema found.',
      recommendation:
        'If you publish instructional content (guides, tutorials, DIY steps), add HowTo schema. ' +
        'Include a name, description, and at least 3 steps — each with a name and text. ' +
        'HowTo schema is among the strongest answer engine signals for procedural queries.',
    };
  }

  const steps = howToData.step;
  if (!steps || (Array.isArray(steps) && steps.length === 0)) {
    return {
      name: '[AEO] How-To Schema',
      status: 'warn',
      score: 30,
      maxScore: 100,
      message: 'HowTo schema found but has no steps defined.',
      recommendation:
        'Populate the HowTo schema with at least 3 steps. Each step should be a HowToStep object ' +
        'with a "name" (short label) and "text" (full instruction). An empty HowTo schema is ignored by Google.',
    };
  }

  const stepArray = Array.isArray(steps) ? steps : [steps];
  const totalSteps = stepArray.length;

  // Count steps that have both name and text (or itemListElement)
  const wellFormedSteps = stepArray.filter(s => {
    if (typeof s !== 'object' || s === null) return false;
    const hasName = s.name && String(s.name).trim();
    const hasText = (s.text && String(s.text).trim()) ||
                    (s.itemListElement && Array.isArray(s.itemListElement) && s.itemListElement.length > 0);
    return hasName && hasText;
  }).length;

  const qualityRatio = totalSteps > 0 ? wellFormedSteps / totalSteps : 0;

  if (totalSteps >= 3 && qualityRatio >= 0.8) {
    return {
      name: '[AEO] How-To Schema',
      status: 'pass',
      score: 100,
      maxScore: 100,
      message: `HowTo schema with ${totalSteps} well-formed steps.`,
      details: `Steps: ${totalSteps} · Each step has name + text`,
    };
  }

  // Partial quality or too few steps
  let score = 60;
  const issues = [];
  if (totalSteps < 3) issues.push(`only ${totalSteps} step${totalSteps === 1 ? '' : 's'} (3+ recommended)`);
  if (qualityRatio < 0.8) issues.push(`${wellFormedSteps}/${totalSteps} steps have both name and text`);

  return {
    name: '[AEO] How-To Schema',
    status: 'warn',
    score,
    maxScore: 100,
    message: `HowTo schema found but incomplete: ${issues.join('; ')}.`,
    details: `Total steps: ${totalSteps} · Well-formed: ${wellFormedSteps}`,
    recommendation:
      'Ensure each HowToStep has both a "name" (e.g. "Mix the ingredients") and "text" ' +
      '(the full instruction). Add at least 3 steps to maximise rich result eligibility.',
  };
}

module.exports = aeoHowToSchemaAudit;
