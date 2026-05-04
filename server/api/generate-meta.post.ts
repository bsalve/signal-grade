import { createRequire } from 'module'
import { join } from 'path'

const _require = createRequire(import.meta.url)

export default defineEventHandler(async (event) => {
  const { requirePro } = _require(join(process.cwd(), 'utils/tiers.js'))
  requirePro(event)

  const body = await readBody(event)
  const { url, type } = body ?? {}

  if (!url || !type || !['title', 'description'].includes(type)) {
    throw createError({ statusCode: 400, message: 'url and type (title|description) are required' })
  }

  // Fetch the page and extract key content signals
  const { fetchPage } = _require(join(process.cwd(), 'utils/fetcher.js'))
  let pageContext = ''
  try {
    const { $ } = await fetchPage(url)
    const h1 = $('h1').first().text().trim()
    const h2s = $('h2').map((_: any, el: any) => $(el).text().trim()).get().slice(0, 4).join(', ')
    const bodyText = $('body').clone().find('script,style').remove().end().text().replace(/\s+/g, ' ').trim().slice(0, 800)
    const existingTitle = $('title').first().text().trim()
    const existingDesc  = $('meta[name="description"]').attr('content')?.trim() || ''
    pageContext = `URL: ${url}\nH1: ${h1 || 'none'}\nH2s: ${h2s || 'none'}\nExisting title: ${existingTitle || 'none'}\nExisting description: ${existingDesc || 'none'}\nBody excerpt: ${bodyText}`
  } catch {
    pageContext = `URL: ${url}`
  }

  const systemPrompt = type === 'title'
    ? 'You are an SEO expert. Write a concise, compelling page title tag. Rules: 50–60 characters, include the primary keyword near the start, include brand name at end if there is room, no clickbait. Return ONLY the title text — no quotes, no explanation.'
    : 'You are an SEO expert. Write a compelling meta description. Rules: 120–160 characters, include the primary keyword, include a subtle call to action, written for humans not search engines. Return ONLY the description text — no quotes, no explanation.'

  const { callGemini } = _require(join(process.cwd(), 'utils/gemini.js'))

  try {
    const generated = await callGemini(systemPrompt, pageContext, 200)
    return { type, generated }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 502, message: 'Failed to contact AI service.' })
  }
})
