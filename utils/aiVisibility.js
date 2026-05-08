'use strict';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

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
 * Infer the brand's industry category with a single lightweight Groq call.
 * Returns a 2-5 word category label, e.g. "SEO audit tool", "restaurant chain".
 */
async function inferCategory(domain, brand) {
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
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
        seed: 12345,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return 'online service';
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    // Sanitize — strip quotes, punctuation, limit length
    return raw.replace(/["""''.]/g, '').slice(0, 40).toLowerCase() || 'online service';
  } catch {
    return 'online service';
  }
}

/**
 * Run a single Groq query and return the raw response text.
 * Returns null on any error (caller decides abort/continue policy).
 */
async function runGroqQuery(messages) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_tokens: 400,
      temperature: 0,
      seed: 12345,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const err = new Error(`Groq API error ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
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
 * Run a full AI visibility scan: 1 category inference + 10 visibility queries.
 * Aborts and returns error if any query fails — no partial results saved.
 */
async function runVisibilityScan(userId, siteUrl, db) {
  const domain = extractDomain(siteUrl);
  const brand  = extractBrand(siteUrl);

  if (!process.env.GROQ_API_KEY) {
    return { scans: [], mentionRate: 0, platforms: [], error: 'No AI API key configured.' };
  }

  // Step 1: Infer category (non-blocking failure — falls back to 'online service')
  const inferredCategory = await inferCategory(domain, brand);

  // Step 2: Build the 10-query plan
  const queryPlan = [
    // Brand Awareness (3) — does the AI have concrete knowledge of this brand?
    { category: 'awareness', query: `What is ${brand} and what does it offer?` },
    { category: 'awareness', query: `Tell me about ${brand} (${domain}). What is this company or product known for?` },
    { category: 'awareness', query: `Is ${brand} an established, recognized name in its field?` },

    // Category Discovery (4) — would this brand appear in category-level searches?
    { category: 'discovery', query: `What are the leading ${inferredCategory} tools or services?` },
    { category: 'discovery', query: `Recommend some well-established ${inferredCategory} platforms.` },
    { category: 'discovery', query: `What should someone use for ${inferredCategory}? List some well-known options.` },
    { category: 'discovery', query: `Which ${inferredCategory} services are considered reliable and widely used?` },

    // Recommendation (3) — would the AI vouch for this brand?
    { category: 'recommendation', query: `Is ${brand} a trustworthy and reputable service?` },
    { category: 'recommendation', query: `Would you recommend ${brand} for someone looking for ${inferredCategory} solutions?` },
    { category: 'recommendation', query: `What is the general reputation of ${brand} among users in its space?` },
  ];

  // Step 3: Run all 10 queries sequentially, aborting on any failure
  const scans = [];

  for (const { category, query } of queryPlan) {
    let responseText = '';
    try {
      const messages = category === 'discovery'
        ? buildDiscoveryMessages(query, domain, brand)
        : buildBrandMessages(query, domain, brand);
      responseText = await runGroqQuery(messages);
    } catch (err) {
      const isApiError = err?.status;
      console.error(`[aiVisibility] Query failed (${isApiError ? `Groq ${err.status}` : 'network/timeout'}): ${query.slice(0, 60)}`);
      const msg = isApiError ? `Groq API error ${err.status}` : 'Request timed out or network error';
      return { scans: [], mentionRate: 0, platforms: ['groq'], inferredCategory, error: msg };
    }

    const mentioned = detectMention(responseText);
    const sentiment = mentioned ? detectSentiment(responseText) : null;
    const excerpt   = extractExcerpt(responseText);
    scans.push({ query, query_category: category, mentioned, sentiment, excerpt, platform: 'groq' });
  }

  // Step 4: Score
  const mentionCount = scans.filter(s => s.mentioned).length;
  const mentionRate  = Math.round((mentionCount / scans.length) * 100);
  const categoryScores = computeCategoryScores(scans);

  // Step 5: Persist — delete old rows, insert new batch (only if all 10 succeeded)
  if (db && scans.length === queryPlan.length) {
    try {
      await db('ai_visibility_scans').where({ user_id: userId, domain }).delete();
      await db('ai_visibility_scans').insert(
        scans.map(s => ({
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
    } catch (err) {
      console.error('[aiVisibility] DB write failed:', err?.message || err);
    }
  }

  return { scans, mentionRate, categoryScores, inferredCategory, domain, brand, platforms: ['groq'] };
}

module.exports = { runVisibilityScan };
