const axios = require('axios');

const AUDIT_NAME = '[Technical] Robots.txt Safety';

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
      message: 'robots.txt not found or unreachable — safety check skipped.',
    };
  }

  const lines = body.split('\n').map(l => l.trim());
  const dangerous = [];
  let inScope = false;

  for (const line of lines) {
    // Enter scope when User-agent is * or Googlebot
    if (/^user-agent:\s*(\*|googlebot)$/i.test(line)) { inScope = true; continue; }
    // Exit scope on any other User-agent line
    if (/^user-agent:/i.test(line)) { inScope = false; continue; }
    if (!inScope) continue;

    if (/^disallow:\s*\/\s*$/i.test(line)) {
      dangerous.push({ level: 'fail', msg: 'Disallow: / — entire site is blocked from crawling' });
    } else if (/^disallow:.*\.(css|js)(\?.*)?$/i.test(line)) {
      dangerous.push({ level: 'warn', msg: `Rendering resource blocked: ${line}` });
    }
  }

  if (dangerous.some(d => d.level === 'fail')) {
    return {
      name: AUDIT_NAME,
      status: 'fail',
      score: 0,
      message: 'robots.txt is blocking the entire site from being crawled.',
      details: dangerous.map(d => `• ${d.msg}`).join('\n'),
      recommendation:
        'Remove or change "Disallow: /" under User-agent: * or User-agent: Googlebot. ' +
        'This rule prevents all search engines from crawling your site, making it invisible ' +
        'in search results. Replace with "Allow: /" or remove the disallow line entirely.',
    };
  }

  if (dangerous.length > 0) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: 'robots.txt may be blocking CSS or JS rendering resources.',
      details: dangerous.map(d => `• ${d.msg}`).join('\n'),
      recommendation:
        'Allow Googlebot to access CSS and JavaScript files needed to render your pages. ' +
        'Blocking these prevents Google from seeing your page as users do, which can negatively ' +
        'impact rankings. Remove the disallow rules for .css and .js file patterns.',
    };
  }

  return {
    name: AUDIT_NAME,
    status: 'pass',
    score: 100,
    message: 'robots.txt contains no dangerous blocking directives.',
  };
};
