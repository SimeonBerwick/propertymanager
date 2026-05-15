import { createHash } from 'node:crypto'
import { headers } from 'next/headers'

type LogLevel = 'info' | 'warn' | 'error'
type LogDetails = Record<string, unknown>

function getLogSink(level: LogLevel) {
  if (level === 'error') return console.error
  if (level === 'warn') return console.warn
  return console.log
}

function sanitize(value: unknown): unknown {
  if (value == null) return value
  if (Array.isArray(value)) return value.map(sanitize)
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) return { name: value.name, message: value.message }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, sanitize(entry)]),
    )
  }
  return value
}

export function hashIdentifier(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 16)
}

export async function logAppEvent(level: LogLevel, event: string, details: LogDetails = {}) {
  const headerStore = await headers()
  const safeDetails = sanitize(details) as Record<string, unknown>
  getLogSink(level)(JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    app: 'property-manager-v1-web',
    env: process.env.NODE_ENV ?? 'development',
    requestId:
      headerStore.get('x-request-id')
      ?? headerStore.get('x-vercel-id')
      ?? headerStore.get('cf-ray')
      ?? undefined,
    route:
      headerStore.get('x-pathname')
      ?? headerStore.get('next-url')
      ?? headerStore.get('referer')
      ?? undefined,
    ...safeDetails,
  }))
}

export async function logAppError(event: string, error: unknown, details: LogDetails = {}) {
  await logAppEvent('error', event, {
    ...details,
    error,
  })
}
