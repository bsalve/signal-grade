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
 * @param {function} [opts.onProgress] - called after each check: ({ name, completed, total })
 */
async function runPageAudit(url, audits, opts = {}) {
  const { jsRender = false, jsRenderTimeout = 15000, onProgress } = opts
  const { html, $, headers, finalUrl, responseTimeMs } = jsRender
    ? await fetchPageWithJS(url, jsRenderTimeout)
    : await fetchPage(url)
  const meta = { headers, finalUrl, responseTimeMs }

  const results = []
  const total = audits.length
  for (let i = 0; i < total; i++) {
    const a = audits[i]
    let raw = null
    try {
      raw = await new Promise((resolve) => resolve(a($, html, url, meta)))
    } catch {}
    if (raw) {
      const items = Array.isArray(raw) ? raw : [raw]
      for (const item of items) {
        if (item) results.push(item)
      }
    }
    if (onProgress) {
      const name = (Array.isArray(raw) ? raw[0]?.name : raw?.name) || ''
      onProgress({ name, completed: i + 1, total })
    }
  }

  const score = calcTotalScore(results)
  const grade = letterGrade(score)
  return { results, score, grade, finalUrl, responseTimeMs }
}

module.exports = { runPageAudit }
