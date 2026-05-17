'use strict';

const KEY_FIELDS = ['name', 'description', 'thumbnailUrl', 'uploadDate', 'duration'];

function aeoVideoSchemaAudit($, html) {
  const scripts = $('script[type="application/ld+json"]');

  // Check for YouTube iframes missing title attribute
  const ytIframes = $('iframe[src*="youtube"]');
  const ytMissingTitle = [];
  ytIframes.each((_, el) => {
    const src = $(el).attr('src') || '';
    const title = $(el).attr('title');
    if (!title || !title.trim()) {
      ytMissingTitle.push(src.split('?')[0]);
    }
  });

  if (scripts.length === 0) {
    const result = {
      name: '[AEO] Video Schema',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No JSON-LD structured data found.',
      recommendation:
        'If you publish video content, add VideoObject schema. Include name, description, ' +
        'thumbnailUrl, uploadDate, and duration to qualify for video rich results in Google Search.',
    };
    if (ytMissingTitle.length) {
      result.details = `YouTube embed${ytMissingTitle.length > 1 ? 's' : ''} missing title attribute (accessibility + SEO): ${ytMissingTitle.slice(0, 3).join(', ')}`;
    }
    return result;
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
    const result = {
      name: '[AEO] Video Schema',
      status: 'fail',
      score: 0,
      maxScore: 100,
      message: 'No VideoObject schema found.',
      recommendation:
        'If you publish video content, add VideoObject schema with name, description, thumbnailUrl, ' +
        'uploadDate, and duration. Video rich results significantly increase click-through rates and are ' +
        'directly cited by AI search engines like Gemini and Perplexity.',
    };
    if (ytMissingTitle.length) {
      result.details = `YouTube embed${ytMissingTitle.length > 1 ? 's' : ''} missing title attribute: ${ytMissingTitle.slice(0, 3).join(', ')}`;
    }
    return result;
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
  else if (count <= 4){ score = 85; status = 'warn'; }
  else                { score = 100; status = 'pass'; }

  const detailParts = [];
  if (presentFields.length) detailParts.push(`Present: ${presentFields.join(', ')}`);
  if (missingFields.length)  detailParts.push(`Missing: ${missingFields.join(', ')}`);
  if (ytMissingTitle.length) detailParts.push(`YouTube embed${ytMissingTitle.length > 1 ? 's' : ''} missing title: ${ytMissingTitle.slice(0, 3).join(', ')}`);

  // Check for contentUrl / embedUrl (needed for video sitemap eligibility)
  const hasSitemapField = videoData.contentUrl || videoData.embedUrl;

  const recParts = [];
  if (missingFields.length > 0) {
    recParts.push(
      `Add the missing VideoObject field${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(', ')}. ` +
      'All five fields (name, description, thumbnailUrl, uploadDate, duration) are required for Google video rich results.'
    );
  }
  if (!hasSitemapField) {
    recParts.push('Add contentUrl or embedUrl to your VideoObject schema to enable video sitemap eligibility.');
  }
  if (ytMissingTitle.length) {
    recParts.push('Add a descriptive title attribute to each YouTube iframe embed (e.g. title="Product demo video") for accessibility and SEO.');
  }

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
    recommendation: recParts.length > 0 ? recParts.join(' ') : undefined,
  };
}

module.exports = aeoVideoSchemaAudit;
