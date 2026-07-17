import { sendNotification } from '@/lib/notify'
import { takeRateLimitHit } from '@/lib/rate-limit'

const SENSITIVE_KEY_PATTERN = /(authorization|cookie|credential|database.?url|email|key|otp|pass(word)?|secret|session|token)/i
const URL_CREDENTIAL_PATTERN = /([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+(?::[^\s/@]*)?@/gi
const BEARER_PATTERN = /bearer\s+[a-z0-9._~+\/-]+/gi

function safeString(value: string) {
  return value
    .replace(URL_CREDENTIAL_PATTERN, '$1[redacted]@')
    .replace(BEARER_PATTERN, 'Bearer [redacted]')
    .slice(0, 1000)
}

export function redactOperatorAlertDetails(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[truncated]'
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') return safeString(value)
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) {
    return { name: value.name, message: safeString(value.message) }
  }
  if (Array.isArray(value)) return value.slice(0, 25).map((entry) => redactOperatorAlertDetails(entry, depth + 1))
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([key, entry]) => [key, SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : redactOperatorAlertDetails(entry, depth + 1)]),
    )
  }
  return String(value)
}

export async function sendOperatorFailureAlert(area: string, details: unknown) {
  const to = process.env.OPS_ALERT_EMAIL?.trim()
  if (!to) return { ok: false, skipped: true }
  const text = JSON.stringify(redactOperatorAlertDetails(details), null, 2) ?? '[no details]'
  return sendNotification({
    to,
    subject: `[Simeonware alert] ${area} needs attention`,
    text: [`A hosted background check reported a problem.`, '', `Area: ${area}`, '', text.slice(0, 6000)].join('\n'),
  }, { bypassUserPreference: true })
}

export async function sendThrottledOperatorErrorAlert(event: string, error: unknown, details: unknown) {
  if (!process.env.OPS_ALERT_EMAIL?.trim()) return { ok: false, skipped: true }

  const throttle = await takeRateLimitHit(`operator-alert:${event}`, {
    limit: 2,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  }).catch(() => ({ ok: true as const, remaining: 0 }))

  if (!throttle.ok) return { ok: false, skipped: true, throttled: true }
  return sendOperatorFailureAlert(event, { error, details })
}

function hasFailureValue(value: unknown) {
  if (value == null) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return false
}

export function resultHasFailures(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(resultHasFailures)

  return Object.entries(value as Record<string, unknown>).some(([key, entry]) => {
    const normalizedKey = key.toLowerCase()
    if (normalizedKey === 'ok' && entry === false) return true
    if (/^(error|errors|failed|failure|failures|failurecount|deliveryfailurecount)$/.test(normalizedKey)) {
      return hasFailureValue(entry)
    }
    return resultHasFailures(entry)
  })
}
