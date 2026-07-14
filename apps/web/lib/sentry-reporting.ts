const SENSITIVE_KEY = /(authorization|cookie|credential|database.?url|email|key|otp|pass(word)?|secret|session|token)/i
const URL_CREDENTIAL = /([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+(?::[^\s/@]*)?@/gi
const BEARER = /bearer\s+[a-z0-9._~+\/-]+/gi
const EMAIL = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi

function safeText(value: string) {
  return value.replace(URL_CREDENTIAL, '$1[redacted]@').replace(BEARER, 'Bearer [redacted]').replace(EMAIL, '[redacted-email]').slice(0, 1000)
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[truncated]'
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') return safeText(value)
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => scrub(item, depth + 1))
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 50).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? '[redacted]' : scrub(item, depth + 1)]))
  }
  return safeText(String(value))
}

type SentryDetails = {
  area?: string
  path?: string
  method?: string
  tags?: Record<string, string | number | boolean | null | undefined>
  extra?: unknown
}

function sentryConfig() {
  const raw = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
  if (!raw) return null
  try {
    const dsn = new URL(raw)
    const projectId = dsn.pathname.split('/').filter(Boolean).at(-1)
    if (!projectId || !dsn.username) return null
    return {
      dsn: raw,
      key: dsn.username,
      endpoint: `${dsn.protocol}//${dsn.host}/api/${projectId}/envelope/`,
    }
  } catch {
    return null
  }
}

function normalizedError(error: unknown) {
  if (error instanceof Error) {
    return {
      type: error.name || 'Error',
      value: String(scrub(error.message)),
      stacktrace: error.stack ? { frames: error.stack.split('\n').slice(0, 40).map((line) => ({ filename: line.trim() })) } : undefined,
    }
  }
  return { type: 'Error', value: String(scrub(error)) }
}

export async function captureSentryException(error: unknown, details: SentryDetails = {}) {
  const config = sentryConfig()
  if (!config) return { ok: false, skipped: true, eventId: null }

  const eventId = crypto.randomUUID().replaceAll('-', '')
  const sentAt = new Date().toISOString()
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    server_name: process.env.VERCEL_REGION,
    transaction: details.area ?? details.path ?? 'application-error',
    request: details.path ? { url: details.path, method: details.method } : undefined,
    tags: Object.fromEntries(Object.entries(details.tags ?? {}).filter(([, value]) => value != null).map(([key, value]) => [key, String(value)])),
    extra: scrub(details.extra),
    exception: { values: [normalizedError(error)] },
  }
  const envelope = [
    JSON.stringify({ event_id: eventId, dsn: config.dsn, sent_at: sentAt }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n')

  try {
    const response = await fetch(`${config.endpoint}?sentry_key=${encodeURIComponent(config.key)}&sentry_version=7`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-sentry-envelope' },
      body: envelope,
      cache: 'no-store',
    })
    return { ok: response.ok, skipped: false, eventId }
  } catch (reportingError) {
    console.error('[SENTRY] Error reporting failed', reportingError)
    return { ok: false, skipped: false, eventId }
  }
}
