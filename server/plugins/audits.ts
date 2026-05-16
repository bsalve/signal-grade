import { createRequire } from 'module'
import { readdirSync } from 'fs'
import { join } from 'path'

const _require = createRequire(import.meta.url)

// Mirrors the skip list in utils/crawler.js — slow or domain-level checks
// that aren't worth the wait in bulk (batch comparison) audits.
const BULK_SKIP = new Set([
  'checkPageSpeed.js',
  'technicalBrokenLinks.js',
  'technicalCanonicalChain.js',
  'contentOGImageCheck.js',
  'technicalRedirectChain.js',
  'checkCrawlability.js',
  'technicalRobotsSafety.js',
  'geoLlmsTxt.js',
  'geoAICrawlerAccess.js',
  'technicalSitemapValidation.js',
  'technicalCrawlDelay.js',
  'geoAIPresence.js',
  'technicalJsBundleSize.js',
  'technicalDnsTtl.js',
  'geoSameAsAuthority.js',
  'contentSpelling.js',
  'technicalAMP.js',
])

export default defineNitroPlugin((nitroApp: any) => {
  const auditDir = join(process.cwd(), 'audits')
  const auditFiles = readdirSync(auditDir).filter((f) => f.endsWith('.js'))
  nitroApp.audits     = auditFiles.map((f) => _require(join(auditDir, f)))
  nitroApp.bulkAudits = auditFiles.filter((f) => !BULK_SKIP.has(f)).map((f) => _require(join(auditDir, f)))
  console.log(`[nitro] Loaded ${nitroApp.audits.length} audit modules (${nitroApp.bulkAudits.length} for bulk)`)
})
