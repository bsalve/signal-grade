import { createRequire } from 'module'
import { readdirSync } from 'fs'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineNitroPlugin((nitroApp: any) => {
  const auditDir = join(process.cwd(), 'audits')
  const auditFiles = readdirSync(auditDir).filter((f) => f.endsWith('.js'))
  nitroApp.audits = auditFiles.map((f) => _require(join(auditDir, f)))
  console.log(`[nitro] Loaded ${nitroApp.audits.length} audit modules`)
})
