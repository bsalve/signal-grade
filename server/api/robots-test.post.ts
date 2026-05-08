import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

// Crawlers to test, with all User-agent names they might match
const CRAWLERS: Record<string, string[]> = {
  Googlebot:     ['Googlebot', 'Googlebot-Image', 'Googlebot-News'],
  GPTBot:        ['GPTBot'],
  ClaudeBot:     ['ClaudeBot', 'anthropic-ai'],
  PerplexityBot: ['PerplexityBot'],
  Bingbot:       ['Bingbot', 'msnbot'],
  CCBot:         ['CCBot'],
}

function parseRobots(body: string): Map<string, { allows: string[]; disallows: string[] }> {
  const blocks = new Map<string, { allows: string[]; disallows: string[] }>()
  const lines = body.split('\n').map(l => l.replace(/#.*$/, '').trim()).filter(Boolean)

  let currentAgents: string[] = []
  for (const line of lines) {
    if (/^user-agent:/i.test(line)) {
      const agent = line.replace(/^user-agent:\s*/i, '').trim()
      // Start a new group unless we're continuing a multi-agent block
      if (currentAgents.length === 0 || blocks.get(currentAgents[0])?.allows.length || blocks.get(currentAgents[0])?.disallows.length) {
        currentAgents = [agent]
      } else {
        currentAgents.push(agent)
      }
      for (const a of currentAgents) {
        if (!blocks.has(a)) blocks.set(a, { allows: [], disallows: [] })
      }
    } else if (/^allow:/i.test(line)) {
      const path = line.replace(/^allow:\s*/i, '').trim()
      for (const a of currentAgents) {
        blocks.get(a)?.allows.push(path)
      }
    } else if (/^disallow:/i.test(line)) {
      const path = line.replace(/^disallow:\s*/i, '').trim()
      for (const a of currentAgents) {
        blocks.get(a)?.disallows.push(path)
      }
    } else if (line === '') {
      currentAgents = []
    }
  }
  return blocks
}

function isPathAllowed(urlPath: string, rules: { allows: string[]; disallows: string[] }): 'allowed' | 'blocked' {
  if (!rules) return 'allowed'
  // Empty disallows = everything allowed
  const disallows = rules.disallows.filter(d => d !== '')
  if (!disallows.length) return 'allowed'

  // Find the longest matching rule (allows win ties)
  let bestLen = -1
  let result: 'allowed' | 'blocked' = 'allowed'

  for (const allow of rules.allows) {
    if (urlPath.startsWith(allow) && allow.length > bestLen) {
      bestLen = allow.length
      result = 'allowed'
    }
  }
  for (const disallow of disallows) {
    if (urlPath.startsWith(disallow) && disallow.length > bestLen) {
      bestLen = disallow.length
      result = 'blocked'
    } else if (urlPath.startsWith(disallow) && disallow.length === bestLen && result === 'blocked') {
      // Allow wins tie
      // already handled above
    }
  }
  return bestLen === -1 ? 'allowed' : result
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { url } = body ?? {}
  if (!url) throw createError({ statusCode: 400, message: 'url is required' })

  let origin: string
  let urlPath: string
  try {
    const parsed = new URL(url)
    origin  = parsed.origin
    urlPath = parsed.pathname || '/'
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid URL' })
  }

  const axios = _require(join(process.cwd(), 'node_modules/axios/index.js'))
  let raw: string
  let found = true

  try {
    const res = await axios.get(`${origin}/robots.txt`, {
      timeout: 8000,
      maxRedirects: 3,
      validateStatus: (s: number) => s < 500,
      headers: { 'User-Agent': 'SearchGrade/1.0' },
    })
    if (res.status === 404) {
      found = false
      raw = ''
    } else {
      raw = String(res.data)
    }
  } catch {
    found = false
    raw = ''
  }

  if (!found) {
    const crawlers: Record<string, string> = {}
    for (const name of Object.keys(CRAWLERS)) crawlers[name] = 'allowed'
    return { found: false, robotsUrl: `${origin}/robots.txt`, crawlers }
  }

  const blocks = parseRobots(raw)
  const crawlers: Record<string, string> = {}

  for (const [crawlerName, agentNames] of Object.entries(CRAWLERS)) {
    // Try specific agent names first, then fall back to wildcard *
    let status: 'allowed' | 'blocked' = 'allowed'
    let matched = false
    for (const agent of agentNames) {
      if (blocks.has(agent)) {
        status = isPathAllowed(urlPath, blocks.get(agent)!)
        matched = true
        break
      }
    }
    if (!matched && blocks.has('*')) {
      status = isPathAllowed(urlPath, blocks.get('*')!)
    }
    crawlers[crawlerName] = status
  }

  return { found: true, robotsUrl: `${origin}/robots.txt`, crawlers }
})
