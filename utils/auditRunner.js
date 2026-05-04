'use strict';

const { fetchPage, fetchPageWithJS } = require('./fetcher.js')
const { calcTotalScore, letterGrade } = require('./score.js')

/**
 * Fetch a page and run all audit modules against it.
 * Returns { results, score, grade, finalUrl, responseTimeMs }.
 * Individual audit failures are isolated — a failing check returns null and is filtered out.
 *
 * @param {string} url
 * @param {Function[]} audits - array of audit module functions
 * @param {object} [opts]
 * @param {boolean} [opts.jsRender=false] - use headless JS rendering
 * @param {number}  [opts.jsRenderTimeout=15000]
 */
async function runPageAudit(url, audits, opts = {}) {
  const { jsRender = false, jsRenderTimeout = 15000 } = opts
  const { html, $, headers, finalUrl, responseTimeMs } = jsRender
    ? await fetchPageWithJS(url, jsRenderTimeout)
    : await fetchPage(url)
  const meta = { headers, finalUrl, responseTimeMs }
  const results = (
    await Promise.all(
      audits.map((a) => new Promise((resolve) => resolve(a($, html, url, meta))).catch(() => null))
    )
  ).flat().filter(Boolean)
  const score = calcTotalScore(results)
  const grade = letterGrade(score)
  return { results, score, grade, finalUrl, responseTimeMs }
}

module.exports = { runPageAudit }
