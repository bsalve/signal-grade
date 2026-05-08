'use strict';

async function sendSlackNotification(webhookUrl, { title, url, score, grade, type = 'audit', dropFrom = null }) {
  const color  = grade === 'A' ? '#34d399' : grade === 'B' ? '#4d9fff' : grade === 'C' ? '#ffb800' : '#ff4455';
  const emoji  = type === 'regression' ? ':warning:' : ':white_check_mark:';
  const header = type === 'regression'
    ? `${emoji} *Score Drop Alert* — ${url}`
    : `${emoji} *Scheduled Audit Complete* — ${url}`;
  const body   = type === 'regression'
    ? `Score dropped from *${dropFrom}* to *${score}* (Grade ${grade})`
    : `Score: *${score}/100* — Grade *${grade}*`;

  const payload = {
    text: header,
    attachments: [{
      color,
      fields: [{ value: body, short: false }],
      footer: 'SearchGrade',
    }],
  };

  await fetch(webhookUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
    signal:  AbortSignal.timeout(6000),
  });
}

async function sendTeamsNotification(webhookUrl, { title, url, score, grade, type = 'audit', dropFrom = null }) {
  const color  = grade === 'A' ? '34d399' : grade === 'B' ? '4d9fff' : grade === 'C' ? 'ffb800' : 'ff4455';
  const header = type === 'regression'
    ? `⚠️ Score Drop Alert — ${url}`
    : `✅ Scheduled Audit Complete — ${url}`;
  const body   = type === 'regression'
    ? `Score dropped from **${dropFrom}** to **${score}** (Grade ${grade})`
    : `Score: **${score}/100** — Grade **${grade}**`;

  const payload = {
    '@type':      'MessageCard',
    '@context':   'http://schema.org/extensions',
    themeColor:   color,
    summary:      header,
    sections: [{
      activityTitle: header,
      activityText:  body,
    }],
  };

  await fetch(webhookUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
    signal:  AbortSignal.timeout(6000),
  });
}

module.exports = { sendSlackNotification, sendTeamsNotification };
