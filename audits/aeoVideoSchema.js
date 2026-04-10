'use strict';

const KEY_FIELDS = ['name', 'description', 'thumbnailUrl', 'uploadDate'];

function aeoVideoSchemaAudit($, html) {
  const scripts = $('script[type="application/ld+json"]');

  if (scripts.length === 0) {
    return {
      name: '[AEO] Video Schema',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No JSON-LD structured data found.',
      recommendation:
        'If you publish video content, add VideoObject schema. Include name, description, ' +
        'thumbnailUrl, and uploadDate to qualify for video rich results in Google Search.',
    };
  }

  let videoData = null;

  scripts.each((_, el) => {
    if (videoData) return;
    try {
      const data = JSON.parse($(el).html());
      const objects = data['@graph'] ? data['@graph'] : [data];
      for (const obj of objects) {
        const type = obj['@type'];
        const types = Array.isArray(type) ? type : [type];
        if (types.includes('VideoObject')) {
          videoData = obj;
          break;
        }
        // Also accept video embedded in another entity (e.g. Article.video)
        if (obj.video && typeof obj.video === 'object' && obj.video['@type'] === 'VideoObject') {
          videoData = obj.video;
          break;
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  if (!videoData) {
    return {
      name: '[AEO] Video Schema',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No VideoObject schema found.',
      recommendation:
        'If you publish video content, add VideoObject schema with name, description, thumbnailUrl, ' +
        'and uploadDate. Video rich results significantly increase click-through rates and are ' +
        'directly cited by AI search engines like Gemini and Perplexity.',
    };
  }

  const presentFields = KEY_FIELDS.filter(f => {
    const v = videoData[f];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });
  const missingFields = KEY_FIELDS.filter(f => !presentFields.includes(f));
  const count = presentFields.length;

  let score, status;
  if (count <= 1)     { score = 40; status = 'warn'; }
  else if (count <= 3){ score = 70; status = 'warn'; }
  else                { score = 100; status = 'pass'; }

  const detailParts = [];
  if (presentFields.length) detailParts.push(`Present: ${presentFields.join(', ')}`);
  if (missingFields.length)  detailParts.push(`Missing: ${missingFields.join(', ')}`);

  return {
    name: '[AEO] Video Schema',
    status,
    score,
    maxScore: 100,
    message:
      count === KEY_FIELDS.length
        ? 'VideoObject schema is complete with all key fields.'
        : `VideoObject schema found but missing key fields (${count}/${KEY_FIELDS.length} present).`,
    details: detailParts.join(' · ') || undefined,
    recommendation:
      missingFields.length > 0
        ? `Add the missing VideoObject field${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(', ')}. ` +
          'All four fields (name, description, thumbnailUrl, uploadDate) are required for Google video rich results.'
        : undefined,
  };
}

module.exports = aeoVideoSchemaAudit;
