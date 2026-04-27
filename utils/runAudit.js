'use strict';

const { join, basename } = require('path');

/**
 * Run a page audit for a given URL and save the report.
 * Used by both audit.post.ts (via HTTP handler) and the scheduler plugin.
 *
 * @param {object} opts
 * @param {string}      opts.url
 * @param {number|null} opts.userId
 * @param {any[]}       opts.audits   - loaded audit modules (from useNitroApp().audits)
 * @param {string|null} [opts.logoUrl]
 * @returns {Promise<{ score, grade, pdfFile, r2Key, results, jsonOutput }>}
 */
async function runAudit({ url, userId, audits, logoUrl = null }) {
  const { fetchPage }   = require(join(process.cwd(), 'utils/fetcher.js'));
  const { calcTotalScore, letterGrade, buildJsonOutput } = require(join(process.cwd(), 'utils/score.js'));
  const { generatePDF } = require(join(process.cwd(), 'utils/generatePDF.js'));
  const db              = require(join(process.cwd(), 'utils/db.js'));
  const r2              = require(join(process.cwd(), 'utils/r2.js'));

  const { html, $, headers, finalUrl, responseTimeMs } = await fetchPage(url);
  const meta = { headers, finalUrl, responseTimeMs };
  const results = (
    await Promise.all(audits.map((a) => new Promise((resolve) => resolve(a($, html, url, meta))).catch(() => null)))
  ).flat().filter(Boolean);

  const score = calcTotalScore(results);
  const grade = letterGrade(score);
  const jsonOutput = buildJsonOutput(url, results, score, grade);
  const pdfPath = await generatePDF(jsonOutput, { logoUrl });
  const pdfFile = basename(pdfPath);

  let r2Key = null;
  if (r2.isConfigured() && userId) {
    try {
      r2Key = `reports/${userId}/${pdfFile}`;
      await r2.uploadPDF(pdfPath, r2Key);
    } catch (e) {
      console.error('[runAudit] R2 upload failed:', e.message);
      r2Key = null;
    }
  }

  if (db && userId) {
    await db('reports')
      .insert({ user_id: userId, url, audit_type: 'page', score, grade, pdf_filename: pdfFile, r2_key: r2Key, results_json: JSON.stringify(results) })
      .catch((err) => console.error('[runAudit] DB insert failed:', err.message));
  }

  return { score, grade, pdfFile, r2Key, results, jsonOutput };
}

module.exports = { runAudit };
