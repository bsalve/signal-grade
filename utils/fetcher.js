const axios = require('axios');
const cheerio = require('cheerio');

async function fetchPage(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'LocalSEOAuditBot/1.0',
    },
    timeout: 10000,
  });

  const html = response.data;
  const $ = cheerio.load(html);

  return { html, $ };
}

module.exports = { fetchPage };
