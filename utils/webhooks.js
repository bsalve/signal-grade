'use strict';

const crypto = require('crypto');
const db = require('./db');

async function dispatchWebhooks(userId, eventName, payload) {
  if (!db || !userId) return;
  try {
    const hooks = await db('webhooks').where({ user_id: userId });
    for (const hook of hooks) {
      const events = hook.events.split(',').map(e => e.trim());
      if (!events.includes(eventName)) continue;
      const body = JSON.stringify({ event: eventName, data: payload, timestamp: new Date().toISOString() });
      const sig  = crypto.createHmac('sha256', hook.secret).update(body).digest('hex');

      let statusCode = null;
      let responseSnippet = null;
      try {
        const resp = await fetch(hook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-SearchGrade-Signature': `sha256=${sig}` },
          body,
          signal: AbortSignal.timeout(8000),
        });
        statusCode = resp.status;
        const text = await resp.text().catch(() => '');
        responseSnippet = text.slice(0, 200) || null;
      } catch (err) {
        statusCode = 0;
        responseSnippet = (err.message || 'Connection failed').slice(0, 200);
      }

      db('webhook_deliveries').insert({
        webhook_id: hook.id,
        event: eventName,
        status_code: statusCode,
        response_snippet: responseSnippet,
      }).catch(() => {});
    }
  } catch {}
}

module.exports = { dispatchWebhooks };
