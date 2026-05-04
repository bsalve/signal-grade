'use strict';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

module.exports = async function ($, html, url, meta) {
  const name = '[GEO] AI Search Presence';

  if (!process.env.GEMINI_API_KEY) {
    return {
      name,
      status: 'warn',
      score: 50,
      maxScore: 100,
      message: 'GEMINI_API_KEY not set — check skipped.',
      recommendation: 'Add GEMINI_API_KEY to .env to enable live AI search presence checks.',
    };
  }

  let host;
  try {
    host = new URL(meta?.finalUrl || url).hostname.replace(/^www\./, '');
  } catch {
    host = url;
  }

  // Extract brand name: og:site_name > first title segment > domain
  const brand =
    $('meta[property="og:site_name"]').attr('content')?.trim() ||
    $('title').text().split(/[-–|]/)[0].trim() ||
    host;

  const query = `What is ${brand} and what does their website ${host} offer?`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: query }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { maxOutputTokens: 400 },
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      return {
        name, status: 'warn', score: 50, maxScore: 100,
        message: `Gemini API returned ${res.status} — check skipped.`,
      };
    }

    const data = await res.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const citations = chunks.map((c) => c.web?.uri || '').filter(Boolean);

    const inCitations = citations.some((c) => c.includes(host));
    const inText      = responseText.toLowerCase().includes(host.toLowerCase());

    if (inCitations) {
      return {
        name, status: 'pass', score: 100, maxScore: 100,
        message: `${host} was cited by Google AI in response to a brand query.`,
        details: `Query: "${query}"\nCited sources: ${citations.slice(0, 3).join(', ')}`,
      };
    } else if (inText) {
      return {
        name, status: 'warn', score: 60, maxScore: 100,
        message: `${host} was mentioned in AI response text but not in cited sources.`,
        recommendation: 'Improve structured data (Organization schema, sameAs links) and publish authoritative content to increase citation likelihood.',
        details: `Query: "${query}"`,
      };
    } else {
      return {
        name, status: 'fail', score: 0, maxScore: 100,
        message: `${host} was not found in Google AI search results for a brand query.`,
        recommendation: 'Build GEO signals: add Organization schema with sameAs links, publish content that answers questions about your brand, and ensure your domain is crawlable by AI bots.',
        details: `Query: "${query}"`,
      };
    }
  } catch {
    return {
      name, status: 'warn', score: 50, maxScore: 100,
      message: 'AI presence check timed out or failed — skipped.',
      recommendation: 'Check GEMINI_API_KEY and network connectivity.',
    };
  }
};
