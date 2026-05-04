const axios = require('axios');

const AUDIT_NAME = '[GEO] AI Crawler Access';

// Major AI bots that index content for LLM training and AI search features
const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'anthropic-ai',
  'ClaudeBot',
  'PerplexityBot',
  'Googlebot-Extended',
  'Applebot-Extended',
];

// Parse robots.txt into groups (separated by blank lines), then determine
// which of the target bots are fully blocked (Disallow: / without Allow: /).
function getBlockedBots(body, bots) {
  const lines = body
    .split('\n')
    .map(l => l.trim())
    .filter(l => !l.startsWith('#'));

  // Split into groups by blank line
  const groups = [];
  let current = [];
  for (const line of lines) {
    if (line === '') {
      if (current.length > 0) groups.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) groups.push(current);

  const parsedGroups = groups.map(group => ({
    agents: group
      .filter(l => /^user-agent:/i.test(l))
      .map(l => l.replace(/^user-agent:\s*/i, '').trim().toLowerCase()),
    disallowRoot: group.some(l => /^disallow:\s*\/\s*$/i.test(l)),
    allowRoot:    group.some(l => /^allow:\s*\/\s*$/i.test(l)),
  }));

  const wildcardGroup = parsedGroups.find(g => g.agents.includes('*'));

  return bots.filter(bot => {
    const botLower = bot.toLowerCase();
    const specific = parsedGroups.find(g => g.agents.includes(botLower));
    if (specific) {
      return specific.disallowRoot && !specific.allowRoot;
    }
    // Falls back to wildcard
    return wildcardGroup
      ? wildcardGroup.disallowRoot && !wildcardGroup.allowRoot
      : false;
  });
}

module.exports = async function ($, html, url) {
  let baseUrl;
  try {
    const parsed = new URL(url);
    baseUrl = `${parsed.protocol}//${parsed.host}`;
  } catch {
    return { name: AUDIT_NAME, status: 'warn', score: 50, message: 'Could not determine domain root.' };
  }

  let body;
  try {
    const res = await axios.get(`${baseUrl}/robots.txt`, {
      timeout: 8000,
      maxRedirects: 3,
      validateStatus: s => s < 400,
      headers: { 'User-Agent': 'SearchGrade/1.0' },
    });
    body = String(res.data);
  } catch {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'robots.txt not found or unreachable — AI crawler check skipped.',
    };
  }

  const blocked = getBlockedBots(body, AI_BOTS);

  if (blocked.length === 0) {
    return {
      name: AUDIT_NAME,
      status: 'pass',
      score: 100,
      message: 'All major AI crawlers are allowed to access your site.',
      details: `Checked: ${AI_BOTS.join(', ')}`,
    };
  }

  if (blocked.length <= 2) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: `${blocked.length} AI crawler${blocked.length !== 1 ? 's are' : ' is'} blocked in robots.txt.`,
      details: `Blocked: ${blocked.join(', ')}`,
      recommendation:
        'Some AI crawlers are blocked by your robots.txt, which prevents those AI systems from ' +
        'indexing your content for AI search features and citations. If you want your site to appear ' +
        'in AI-powered answers (ChatGPT, Perplexity, Google AI Overviews), remove or adjust the ' +
        `Disallow directives for: ${blocked.join(', ')}.`,
    };
  }

  return {
    name: AUDIT_NAME,
    status: 'fail',
    score: 0,
    message: `${blocked.length} AI crawlers are blocked in robots.txt.`,
    details: `Blocked: ${blocked.join(', ')}`,
    recommendation:
      'Most major AI crawlers are blocked by your robots.txt, significantly reducing your site\'s ' +
      'visibility in AI-powered search results and citation systems. If you want to appear in ' +
      'ChatGPT, Perplexity, Google AI Overviews, and similar tools, remove the Disallow directives ' +
      `for these bots: ${blocked.join(', ')}. ` +
      'If blocking is intentional (e.g., content licensing concerns), this is acceptable but will ' +
      'limit GEO reach.',
  };
};
