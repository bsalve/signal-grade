const axios = require('axios');

const AUDIT_NAME = '[GEO] llms.txt';

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
    const res = await axios.get(`${baseUrl}/llms.txt`, {
      timeout: 8000,
      maxRedirects: 3,
      validateStatus: s => s < 400,
      headers: { 'User-Agent': 'SignalGrade/1.0' },
    });
    body = String(res.data);
  } catch {
    return {
      name: AUDIT_NAME,
      status: 'fail',
      score: 0,
      message: 'No llms.txt file found.',
      recommendation:
        'Create an /llms.txt file at your domain root to help AI assistants understand your site. ' +
        'This emerging standard (similar to robots.txt) lets you provide context about your business, ' +
        'key pages, and content — improving how AI tools like ChatGPT and Perplexity represent your brand. ' +
        'See llmstxt.org for the spec and examples.',
    };
  }

  if (body.trim().length < 100) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 60,
      message: 'llms.txt exists but appears empty or minimal.',
      details: `File length: ${body.trim().length} characters`,
      recommendation:
        'Your /llms.txt file exists but contains very little content. Add a title, a brief description of ' +
        'your business, and links to your most important pages. A well-formed llms.txt helps AI tools ' +
        'accurately summarize and cite your site.',
    };
  }

  return {
    name: AUDIT_NAME,
    status: 'pass',
    score: 100,
    message: 'llms.txt is present and has meaningful content.',
    details: `File length: ${body.trim().length} characters`,
  };
};
