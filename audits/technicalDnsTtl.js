'use strict';

const dns = require('dns');
const { Resolver } = dns.promises;

const AUDIT_NAME = '[Technical] DNS TTL';

module.exports = async function checkDnsTtl($, html, url, meta) {
  let hostname;
  try {
    hostname = new URL(meta?.finalUrl || url).hostname;
  } catch {
    return { name: AUDIT_NAME, status: 'warn', score: 50, message: 'Could not parse page URL.' };
  }

  try {
    const resolver = new Resolver();
    const records  = await resolver.resolve4(hostname, { ttl: true });

    if (!records || records.length === 0) {
      return {
        name: AUDIT_NAME,
        status: 'warn',
        score: 50,
        message: `No A records found for ${hostname}.`,
      };
    }

    const minTtl = Math.min(...records.map(r => r.ttl));
    const score  = minTtl >= 3600 ? 100 : minTtl >= 300 ? 70 : 40;
    const status = minTtl >= 3600 ? 'pass' : 'warn';
    const label  = minTtl >= 3600 ? 'Good (≥1 hour)' : minTtl >= 300 ? 'Acceptable (≥5 min)' : 'Low (<5 min)';

    return {
      name: AUDIT_NAME,
      status,
      score,
      message: `DNS A record TTL for ${hostname} is ${minTtl}s — ${label}.`,
      details: `Records: ${records.map(r => `${r.address} (TTL ${r.ttl}s)`).join(', ')}`,
      ...(minTtl < 3600 && {
        recommendation:
          'A low DNS TTL increases resolver re-query frequency, adding DNS lookup time for first-time visitors. ' +
          'Set your A record TTL to 3600 (1 hour) or higher for production. ' +
          'Only lower the TTL temporarily when actively migrating or changing IP addresses.',
      }),
    };
  } catch (err) {
    return {
      name: AUDIT_NAME,
      status: 'warn',
      score: 50,
      message: `DNS TTL lookup failed for ${hostname}.`,
      recommendation: `DNS error: ${err.message}. Ensure the domain has valid A records pointing to your server.`,
    };
  }
};
