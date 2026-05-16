'use strict';

const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const APP_URL = process.env.APP_URL || 'https://searchgrade.com';

let client = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function isConfigured() {
  return !!client;
}

function baseTemplate(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b0c0e;font-family:Inter,sans-serif;color:#e4e6ea">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0c0e;padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr>
          <td style="padding-bottom:32px">
            <span style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;letter-spacing:0.12em;color:#e4e6ea;text-transform:uppercase">SEARCHGRADE</span>
          </td>
        </tr>
        <tr>
          <td style="background:#111214;border:1px solid #1e2025;padding:32px 28px">
            <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#e4e6ea">${title}</h1>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding-top:24px;font-size:11px;color:#8892a4;font-family:'Space Mono',monospace;letter-spacing:0.04em">
            You're receiving this because you have a SearchGrade account.
            <a href="${APP_URL}" style="color:#4d9fff;text-decoration:none">${APP_URL.replace(/^https?:\/\//, '')}</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(text, href) {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:10px 22px;background:#4d9fff;color:#fff;font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;text-decoration:none">${text}</a>`;
}

async function sendWelcome(to, name) {
  if (!client) return;
  const displayName = name ? name.split(' ')[0] : 'there';
  const body = `
    <p style="margin:0 0 12px;font-size:14px;color:#e4e6ea">Hey ${displayName},</p>
    <p style="margin:0 0 12px;font-size:14px;color:#8892a4;line-height:1.6">
      Your SearchGrade account is ready. Audit any public URL for free — we'll score your site across technical health, content quality, AEO, and GEO signals.
    </p>
    <p style="margin:0;font-size:14px;color:#8892a4;line-height:1.6">
      Your reports are saved automatically to your dashboard.
    </p>
    ${ctaButton('Run Your First Audit →', APP_URL)}`;
  await client.emails.send({
    from: FROM,
    to,
    subject: 'Welcome to SearchGrade',
    html: baseTemplate('Welcome to SearchGrade', body),
  });
}

async function sendRegressionAlert(to, name, url, oldScore, newScore, grade, diff) {
  if (!client) return;
  const displayName = name ? name.split(' ')[0] : 'there';
  const delta = oldScore - newScore;
  let hostname = url;
  try { hostname = new URL(url).hostname; } catch {}

  let diffHtml = '';
  if (diff) {
    const listItems = (arr) => arr.map(item =>
      `<li style="margin:3px 0;font-size:13px;color:#e4e6ea">${item}</li>`
    ).join('');

    const sections = [];
    if (diff.newFailures && diff.newFailures.length) {
      sections.push(`
        <div style="margin-bottom:12px">
          <div style="font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#ff4455;margin-bottom:6px">New Failures</div>
          <ul style="margin:0;padding-left:18px">${listItems(diff.newFailures)}</ul>
        </div>`);
    }
    if (diff.topDrops && diff.topDrops.length) {
      sections.push(`
        <div style="margin-bottom:12px">
          <div style="font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#ffb800;margin-bottom:6px">Biggest Score Drops</div>
          <ul style="margin:0;padding-left:18px">${diff.topDrops.map(d =>
            `<li style="margin:3px 0;font-size:13px;color:#e4e6ea">${d.name} <span style="color:#ff4455;font-family:'Space Mono',monospace">${d.from} → ${d.to}</span></li>`
          ).join('')}</ul>
        </div>`);
    }
    if (diff.newPasses && diff.newPasses.length) {
      sections.push(`
        <div style="margin-bottom:12px">
          <div style="font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#34d399;margin-bottom:6px">Newly Passing</div>
          <ul style="margin:0;padding-left:18px">${listItems(diff.newPasses)}</ul>
        </div>`);
    }
    if (sections.length) {
      diffHtml = `
        <div style="margin-top:20px;border-top:1px solid #1e2025;padding-top:16px">
          <div style="font-size:13px;font-weight:600;color:#e4e6ea;margin-bottom:12px">What Changed</div>
          ${sections.join('')}
        </div>`;
    }
  }

  const body = `
    <p style="margin:0 0 12px;font-size:14px;color:#e4e6ea">Hey ${displayName},</p>
    <p style="margin:0 0 16px;font-size:14px;color:#8892a4;line-height:1.6">
      A re-audit of <span style="color:#e4e6ea;font-family:'Space Mono',monospace">${hostname}</span> shows a significant score drop.
    </p>
    <table cellpadding="0" cellspacing="0" style="border:1px solid #1e2025;margin-bottom:16px">
      <tr>
        <td style="padding:12px 20px;border-right:1px solid #1e2025;font-family:'Space Mono',monospace;font-size:11px;color:#8892a4;text-transform:uppercase;letter-spacing:0.06em">Previous</td>
        <td style="padding:12px 20px;font-family:'Space Mono',monospace;font-size:11px;color:#8892a4;text-transform:uppercase;letter-spacing:0.06em">Current</td>
      </tr>
      <tr>
        <td style="padding:12px 20px;border-right:1px solid #1e2025;font-family:'Space Mono',monospace;font-size:22px;color:#e4e6ea">${oldScore}<span style="font-size:13px;color:#8892a4">/100</span></td>
        <td style="padding:12px 20px;font-family:'Space Mono',monospace;font-size:22px;color:#ff4455">${newScore}<span style="font-size:13px;color:#8892a4">/100</span>
          <span style="font-size:12px;color:#ff4455;margin-left:8px">↓ ${delta} pts</span>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#8892a4">New grade: <span style="font-family:'Space Mono',monospace;color:#ff4455">${grade}</span>.</p>
    ${diffHtml}
    ${ctaButton('View Dashboard →', APP_URL + '/dashboard')}`;
  await client.emails.send({
    from: FROM,
    to,
    subject: `Score drop alert: ${hostname} is now ${newScore}/100 (was ${oldScore})`,
    html: baseTemplate('Score Drop Detected', body),
  });
}

async function sendScheduledReport(to, name, url, score, grade, downloadUrl) {
  if (!client) return;
  const displayName = name ? name.split(' ')[0] : 'there';
  let hostname = url;
  try { hostname = new URL(url).hostname; } catch {}
  const gradeColor = score >= 90 ? '#34d399' : score >= 80 ? '#4d9fff' : score >= 70 ? '#ffb800' : score >= 60 ? '#ff8800' : '#ff4455';
  const body = `
    <p style="margin:0 0 12px;font-size:14px;color:#e4e6ea">Hey ${displayName},</p>
    <p style="margin:0 0 16px;font-size:14px;color:#8892a4;line-height:1.6">
      Your scheduled audit for <span style="color:#e4e6ea;font-family:'Space Mono',monospace">${hostname}</span> has completed.
    </p>
    <div style="background:#0b0c0e;border:1px solid #1e2025;border-top:3px solid ${gradeColor};padding:20px 24px;margin-bottom:16px;display:inline-block">
      <div style="font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#8892a4;margin-bottom:8px">Score</div>
      <div style="font-family:'Space Mono',monospace;font-size:36px;color:${gradeColor};line-height:1">${grade}</div>
      <div style="font-family:'Space Mono',monospace;font-size:14px;color:#e4e6ea;margin-top:4px">${score}<span style="color:#8892a4">/100</span></div>
    </div>
    ${ctaButton('Download PDF Report →', downloadUrl)}
    <p style="margin-top:20px;margin-bottom:0;font-size:12px;color:#8892a4">
      View your full report history on your <a href="${APP_URL}/dashboard" style="color:#4d9fff;text-decoration:none">dashboard</a>.
    </p>`;
  await client.emails.send({
    from: FROM,
    to,
    subject: `Scheduled report: ${hostname} scored ${score}/100 (${grade})`,
    html: baseTemplate(`Scheduled Audit: ${hostname}`, body),
  });
}

async function sendDigestEmail(to, name, items, period) {
  if (!client) return;
  const displayName = name ? name.split(' ')[0] : 'there';
  const periodLabel = period === 'monthly' ? 'Monthly' : 'Weekly';

  const rows = items.map(item => {
    const gradeColor = item.latestScore >= 90 ? '#34d399' : item.latestScore >= 80 ? '#4d9fff' : item.latestScore >= 70 ? '#ffb800' : item.latestScore >= 60 ? '#ff8800' : '#ff4455';
    const deltaStr = item.delta !== null
      ? (item.delta > 0 ? `<span style="color:#34d399">↑${item.delta}</span>` : item.delta < 0 ? `<span style="color:#ff4455">↓${Math.abs(item.delta)}</span>` : '<span style="color:#8892a4">—</span>')
      : '<span style="color:#8892a4">—</span>';
    return `<tr>
      <td style="padding:10px 16px;border-bottom:1px solid #1e2025;font-family:'Space Mono',monospace;font-size:11px;color:#e4e6ea">${item.domain}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #1e2025;font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:${gradeColor};text-align:center">${item.grade}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #1e2025;font-family:'Space Mono',monospace;font-size:12px;color:${gradeColor};text-align:center">${item.latestScore}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #1e2025;font-family:'Space Mono',monospace;font-size:11px;text-align:center">${deltaStr}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #1e2025;font-size:11px;color:#8892a4">${item.topIssue || '—'}</td>
    </tr>`;
  }).join('');

  const body = `
    <p style="margin:0 0 16px;font-size:14px;color:#e4e6ea">Hey ${displayName},</p>
    <p style="margin:0 0 20px;font-size:14px;color:#8892a4;line-height:1.6">Here's your ${periodLabel.toLowerCase()} summary across your tracked sites.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1e2025;border-collapse:collapse;margin-bottom:20px">
      <thead>
        <tr style="border-bottom:2px solid #1e2025">
          <th style="padding:8px 16px;font-family:'Space Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#8892a4;text-align:left">Domain</th>
          <th style="padding:8px 16px;font-family:'Space Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#8892a4;text-align:center">Grade</th>
          <th style="padding:8px 16px;font-family:'Space Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#8892a4;text-align:center">Score</th>
          <th style="padding:8px 16px;font-family:'Space Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#8892a4;text-align:center">Change</th>
          <th style="padding:8px 16px;font-family:'Space Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#8892a4;text-align:left">Top Issue</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${ctaButton('View Dashboard →', APP_URL + '/dashboard')}`;

  await client.emails.send({
    from: FROM,
    to,
    subject: `Your ${periodLabel} SearchGrade Summary`,
    html: baseTemplate(`${periodLabel} SearchGrade Summary`, body),
  });
}

module.exports = { isConfigured, sendWelcome, sendRegressionAlert, sendScheduledReport, sendDigestEmail };
