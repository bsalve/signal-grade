import { join } from 'path'
import { createReadStream, existsSync } from 'fs'

export default defineEventHandler((event) => {
  const filePart = getRouterParam(event, 'path') ?? ''
  // Prevent directory traversal
  if (filePart.includes('..')) {
    throw createError({ statusCode: 400, message: 'Invalid path' })
  }
  const filePath = join(process.cwd(), 'output', filePart)
  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `inline; filename="${filePart.split('/').pop()}"`)
  return sendStream(event, createReadStream(filePath))
})
