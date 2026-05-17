'use strict';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

// Platform registry — each entry runs the same query plan via its API
const PLATFORMS = {
  groq: {
    url:   'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.1-8b-instant',
    envKey: 'GROQ_API_KEY',
    label: 'LLaMA (Groq)',
  },
  openai: {
    url:   'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY',
    label: 'GPT-4o-mini',
  },
  perplexity: {
    url:   'https://api.perplexity.ai/chat/completions',
    model: 'llama-3.1-sonar-small-128k-online',
    envKey: 'PERPLEXITY_API_KEY',
    label: 'Perplexity',
  },
};

function extractDomain(siteUrl) {
  try { return new URL(siteUrl).hostname.replace(/^www\./, ''); }
  catch { return siteUrl; }
}

function extractBrand(siteUrl) {
  const domain = extractDomain(siteUrl);
  return domain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Detect mention from structured prefix
function detectMention(text) {
  return text.trimStart().toUpperCase().startsWith('MENTIONED:');
}

// Strip the MENTIONED:/NOT MENTIONED: prefix before further analysis
function stripPrefix(text) {
  return text.replace(/^(NOT )?MENTIONED:\s*/i, '').trim();
}

function detectSentiment(text) {
  const lower = stripPrefix(text).toLowerCase();
  const positive = ['great', 'excellent', 'best', 'top', 'trusted', 'popular', 'leading', 'recommended', 'well-known', 'reputable', 'widely used', 'highly regarded'];
  const negative = ['scam', 'poor', 'bad', 'avoid', 'worst', 'unreliable', 'misleading', 'fake', 'spam', 'complaints', 'issues reported'];
  const posScore = positive.filter(w => lower.includes(w)).length;
  const negScore = negative.filter(w => lower.includes(w)).length;
  if (posScore > negScore) return 'positive';
  if (negScore > posScore) return 'negative';
  return 'neutral';
}

function extractExcerpt(text) {
  const body = stripPrefix(text);
  return body.replace(/\s+/g, ' ').trim() || null;
}

/**
 * Build Groq messages for brand awareness and recommendation queries.
 * The LLM is primed to answer about this specific brand and must prefix
 * its response with MENTIONED: or NOT MENTIONED:.
 */
function buildBrandMessages(query, domain, brand) {
  return [
    {
      role: 'system',
      content:
        'You are an AI assistant being evaluated for brand awareness. ' +
        'Answer based strictly on your training data — no speculation. ' +
        'Always start your reply with exactly "MENTIONED:" or "NOT MENTIONED:" ' +
        '(without quotes) before anything else. ' +
        'Use MENTIONED only if you have concrete, specific knowledge of this brand or website. ' +
        'Use NOT MENTIONED if you are uncertain, have only vague knowledge, or have no specific training data about it. ' +
        '"I cannot confirm" and "I have no specific information" both mean NOT MENTIONED.',
    },
    {
      role: 'user',
      content:
        `Brand: ${brand}\nWebsite: ${domain}\n\n` +
        `Question: ${query}\n\n` +
        `Start with "MENTIONED:" or "NOT MENTIONED:" then give a 2-3 sentence answer.`,
    },
  ];
}

/**
 * Build Groq messages for category discovery queries.
 * The LLM answers the category question naturally (without brand priming),
 * then self-evaluates whether it included the brand in its response.
 * This tests organic brand presence in category-level searches.
 */
function buildDiscoveryMessages(query, domain, brand) {
  return [
    {
      role: 'system',
      content:
        `You are a knowledgeable AI assistant. Answer the following question naturally and helpfully, as you would for any user. ` +
        `After your answer, evaluate your own response: start with "MENTIONED:" if you included ${brand} or ${domain} in your answer, ` +
        `or "NOT MENTIONED:" if you did not. ` +
        `Be honest — only include ${brand} if you genuinely know it and would naturally recommend it for this type of question.`,
    },
    {
      role: 'user',
      content: query,
    },
  ];
}

/**
 * Infer the brand's industry category using the first available platform.
 * Returns a 2-5 word category label, e.g. "SEO audit tool", "restaurant chain".
 */
async function inferCategory(domain, brand) {
  const platformKey = Object.keys(PLATFORMS).find(k => !!process.env[PLATFORMS[k].envKey]);
  if (!platformKey) return 'online service';
  const p = PLATFORMS[platformKey];
  try {
    const res = await fetch(p.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env[p.envKey]}`,
      },
      body: JSON.stringify({
        model: p.model,
        messages: [
          {
            role: 'system',
            content: 'Reply with only a 2-5 word category label. No explanation, no punctuation.',
          },
          {
            role: 'user',
            content: `What type of business or service is ${brand} (${domain})? Examples: "SEO audit tool", "restaurant chain", "project management software", "e-commerce platform", "news website". Answer in 2-5 words only.`,
          },
        ],
        max_tokens: 20,
        temperature: 0,
        ...(platformKey !== 'perplexity' ? { seed: 12345 } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return 'online service';
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    return raw.replace(/["""''.]/g, '').slice(0, 40).toLowerCase() || 'online service';
  } catch {
    return 'online service';
  }
}

/**
 * Run a single query against any supported platform API.
 */
async function runPlatformQuery(messages, platformKey) {
  const p = PLATFORMS[platformKey];
  if (!p) throw new Error(`Unknown platform: ${platformKey}`);
  const apiKey = process.env[p.envKey];
  if (!apiKey) throw new Error(`No API key for platform: ${platformKey}`);

  const res = await fetch(p.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: p.model,
      messages,
      max_tokens: 400,
      temperature: 0,
      ...(platformKey !== 'perplexity' ? { seed: 12345 } : {}),
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const err = new Error(`${platformKey} API error ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// Keep backward compat alias used by inferCategory
async function runGroqQuery(messages) {
  return runPlatformQuery(messages, 'groq');
}

/**
 * Compute category sub-scores from a completed scans array.
 */
function computeCategoryScores(scans) {
  const awareness      = scans.filter(s => s.query_category === 'awareness');
  const discovery      = scans.filter(s => s.query_category === 'discovery');
  const recommendation = scans.filter(s => s.query_category === 'recommendation');

  const pct = (arr) => arr.length === 0 ? null : Math.round((arr.filter(s => s.mentioned).length / arr.length) * 100);

  return {
    awareness:      pct(awareness),
    discovery:      pct(discovery),
    recommendation: pct(recommendation),
  };
}

/**
 * Run the 10-query scan for a single platform. Returns { scans, error? }.
 */
async function runPlatformScan(platformKey, queryPlan, domain, brand, inferredCategory) {
  const scans = [];
  for (const { category, query } of queryPlan) {
    let responseText = '';
    try {
      const messages = category === 'discovery'
        ? buildDiscoveryMessages(query, domain, brand)
        : buildBrandMessages(query, domain, brand);
      responseText = await runPlatformQuery(messages, platformKey);
    } catch (err) {
      const isApiError = err?.status;
      console.error(`[aiVisibility/${platformKey}] Query failed (${isApiError ? `${platformKey} ${err.status}` : 'network/timeout'}): ${query.slice(0, 60)}`);
      const msg = isApiError ? `${platformKey} API error ${err.status}` : 'Request timed out or network error';
      return { scans: [], error: msg };
    }
    const mentioned = detectMention(responseText);
    const sentiment = mentioned ? detectSentiment(responseText) : null;
    const excerpt   = extractExcerpt(responseText);
    scans.push({ query, query_category: category, mentioned, sentiment, excerpt, platform: platformKey });
  }
  return { scans };
}

/**
 * Run a full AI visibility scan across all configured platforms.
 * Each platform runs the same 10-query plan. Results are stored per-platform.
 */
async function runVisibilityScan(userId, siteUrl, db) {
  const domain = extractDomain(siteUrl);
  const brand  = extractBrand(siteUrl);

  // Determine which platforms have API keys configured
  const activePlatforms = Object.keys(PLATFORMS).filter(k => !!process.env[PLATFORMS[k].envKey]);
  if (!activePlatforms.length) {
    return { scans: [], mentionRate: 0, platforms: [], error: 'No AI API key configured.' };
  }

  // Step 1: Infer category (use Groq if available, else first available platform)
  const inferredCategory = await inferCategory(domain, brand);

  // Step 2: Build the 10-query plan
  const queryPlan = [
    { category: 'awareness',      query: `What is ${brand} and what does it offer?` },
    { category: 'awareness',      query: `Tell me about ${brand} (${domain}). What is this company or product known for?` },
    { category: 'awareness',      query: `Is ${brand} an established, recognized name in its field?` },
    { category: 'discovery',      query: `What are the leading ${inferredCategory} tools or services?` },
    { category: 'discovery',      query: `Recommend some well-established ${inferredCategory} platforms.` },
    { category: 'discovery',      query: `What should someone use for ${inferredCategory}? List some well-known options.` },
    { category: 'discovery',      query: `Which ${inferredCategory} services are considered reliable and widely used?` },
    { category: 'recommendation', query: `Is ${brand} a trustworthy and reputable service?` },
    { category: 'recommendation', query: `Would you recommend ${brand} for someone looking for ${inferredCategory} solutions?` },
    { category: 'recommendation', query: `What is the general reputation of ${brand} among users in its space?` },
  ];

  // Step 3: Run scans for each active platform (sequentially to avoid rate limits)
  const allScans = [];
  const platformScores = {};
  const errors = [];

  for (const platformKey of activePlatforms) {
    const { scans, error } = await runPlatformScan(platformKey, queryPlan, domain, brand, inferredCategory);
    if (error) {
      errors.push(`${platformKey}: ${error}`);
      continue;
    }
    allScans.push(...scans);
    const mentionCount = scans.filter(s => s.mentioned).length;
    platformScores[platformKey] = {
      mentionRate:    Math.round((mentionCount / scans.length) * 100),
      categoryScores: computeCategoryScores(scans),
      label:          PLATFORMS[platformKey].label,
    };
  }

  if (!allScans.length) {
    return { scans: [], mentionRate: 0, platforms: activePlatforms, error: errors.join('; ') };
  }

  // Step 4: Overall score = average of per-platform mention rates
  const platformKeys = Object.keys(platformScores);
  const overallMentionRate = Math.round(
    platformKeys.reduce((sum, k) => sum + platformScores[k].mentionRate, 0) / platformKeys.length
  );
  const categoryScores = computeCategoryScores(allScans);

  // Step 5: Persist — delete per-platform, insert fresh (preserves other platforms)
  if (db) {
    try {
      for (const platformKey of platformKeys) {
        const platformScans = allScans.filter(s => s.platform === platformKey);
        if (!platformScans.length) continue;
        await db('ai_visibility_scans').where({ user_id: userId, domain, platform: platformKey }).delete();
        await db('ai_visibility_scans').insert(
          platformScans.map(s => ({
            user_id:           userId,
            domain,
            platform:          s.platform,
            query:             s.query,
            query_category:    s.query_category,
            inferred_category: inferredCategory,
            mentioned:         s.mentioned,
            sentiment:         s.sentiment,
            excerpt:           s.excerpt,
          }))
        );
      }
    } catch (err) {
      console.error('[aiVisibility] DB write failed:', err?.message || err);
    }
  }

  return {
    scans: allScans,
    mentionRate: overallMentionRate,
    categoryScores,
    platformScores,
    inferredCategory,
    domain,
    brand,
    platforms: platformKeys,
  };
}

module.exports = { runVisibilityScan };
