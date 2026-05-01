const LOCAL_HOST_PATTERN = /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)([:/]|$)/i
const PLACEHOLDER_PATTERN = /(changeme|placeholder|your-secret-here|example\.com|propertymanager\.local|local-dev|pm-internal-automation-secret-change-me)/i

type RuntimeCheckId =
  | 'databaseUrl'
  | 'sessionSecret'
  | 'appUrl'
  | 'publicAppUrl'
  | 'appUrlParity'
  | 'internalAutomationSecret'
  | 'notifyTransport'
  | 'smtpUrl'
  | 'r2AccountId'
  | 'r2AccessKeyId'
  | 'r2SecretAccessKey'
  | 'r2Bucket'
  | 'mediaBackend'
  | 'upstashRestUrl'
  | 'upstashRestToken'
  | 'rateLimitBackend'

export type RuntimeCapability = 'base' | 'notifications' | 'media' | 'rateLimit'

export type RuntimeCheck = {
  id: RuntimeCheckId
  label: string
  ok: boolean
  blocking: boolean
  detail: string
}

function envValue(name: string) {
  const value = process.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

function hasNonPlaceholderSecret(value: string, minLength = 32) {
  return value.length >= minLength && !PLACEHOLDER_PATTERN.test(value)
}

function isHostedDatabaseUrl(value: string) {
  return !!value && !value.startsWith('file:') && !LOCAL_HOST_PATTERN.test(value)
}

function isHostedUrl(value: string) {
  if (!value) return false

  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !LOCAL_HOST_PATTERN.test(value)
  } catch {
    return false
  }
}

function normalizedUrl(value: string) {
  return value.replace(/\/$/, '')
}

export function hasR2StorageConfig() {
  return !!envValue('R2_ACCOUNT_ID') && !!envValue('R2_ACCESS_KEY_ID') && !!envValue('R2_SECRET_ACCESS_KEY') && !!envValue('R2_BUCKET')
}

export function hasUpstashRateLimitConfig() {
  return !!envValue('UPSTASH_REDIS_REST_URL') && !!envValue('UPSTASH_REDIS_REST_TOKEN')
}

export function isHostedRuntimeEnforced() {
  return process.env.HOSTED_RUNTIME_REQUIRED === 'true' || process.env.VERCEL_ENV === 'production'
}

export function getRuntimeChecks(): RuntimeCheck[] {
  const databaseUrl = envValue('DATABASE_URL')
  const sessionSecret = envValue('SESSION_SECRET')
  const appUrl = envValue('APP_URL')
  const publicAppUrl = envValue('NEXT_PUBLIC_APP_URL')
  const internalAutomationSecret = envValue('INTERNAL_AUTOMATION_SECRET')
  const notifyTransport = envValue('NOTIFY_TRANSPORT') || 'log'
  const smtpUrl = envValue('SMTP_URL')
  const r2AccountId = envValue('R2_ACCOUNT_ID')
  const r2AccessKeyId = envValue('R2_ACCESS_KEY_ID')
  const r2SecretAccessKey = envValue('R2_SECRET_ACCESS_KEY')
  const r2Bucket = envValue('R2_BUCKET')
  const upstashRestUrl = envValue('UPSTASH_REDIS_REST_URL')
  const upstashRestToken = envValue('UPSTASH_REDIS_REST_TOKEN')
  const blocking = isHostedRuntimeEnforced()

  return [
    {
      id: 'databaseUrl',
      label: 'DATABASE_URL',
      ok: isHostedDatabaseUrl(databaseUrl),
      blocking,
      detail: databaseUrl
        ? isHostedDatabaseUrl(databaseUrl)
          ? 'Hosted database URL is configured.'
          : 'Points at local or file-backed storage. Hosted production must use a real managed database.'
        : 'Missing DATABASE_URL.',
    },
    {
      id: 'sessionSecret',
      label: 'SESSION_SECRET',
      ok: hasNonPlaceholderSecret(sessionSecret),
      blocking,
      detail: sessionSecret
        ? hasNonPlaceholderSecret(sessionSecret)
          ? 'Session secret looks production-safe.'
          : 'Secret is too short or still looks like a placeholder.'
        : 'Missing SESSION_SECRET.',
    },
    {
      id: 'appUrl',
      label: 'APP_URL',
      ok: isHostedUrl(appUrl),
      blocking,
      detail: appUrl
        ? isHostedUrl(appUrl)
          ? appUrl
          : 'APP_URL must be an https hosted URL, not localhost.'
        : 'Missing APP_URL.',
    },
    {
      id: 'publicAppUrl',
      label: 'NEXT_PUBLIC_APP_URL',
      ok: isHostedUrl(publicAppUrl),
      blocking,
      detail: publicAppUrl
        ? isHostedUrl(publicAppUrl)
          ? publicAppUrl
          : 'NEXT_PUBLIC_APP_URL must be an https hosted URL, not localhost.'
        : 'Missing NEXT_PUBLIC_APP_URL.',
    },
    {
      id: 'appUrlParity',
      label: 'APP_URL / NEXT_PUBLIC_APP_URL parity',
      ok: !!appUrl && !!publicAppUrl && normalizedUrl(appUrl) === normalizedUrl(publicAppUrl),
      blocking,
      detail: appUrl && publicAppUrl
        ? normalizedUrl(appUrl) === normalizedUrl(publicAppUrl)
          ? 'Server and public URLs match.'
          : 'APP_URL and NEXT_PUBLIC_APP_URL diverge. Links and callbacks will drift.'
        : 'Set both URLs to the same hosted origin.',
    },
    {
      id: 'internalAutomationSecret',
      label: 'INTERNAL_AUTOMATION_SECRET',
      ok: hasNonPlaceholderSecret(internalAutomationSecret),
      blocking,
      detail: internalAutomationSecret
        ? hasNonPlaceholderSecret(internalAutomationSecret)
          ? 'Internal automation secret is configured.'
          : 'Automation secret is too weak or still a placeholder.'
        : 'Missing INTERNAL_AUTOMATION_SECRET.',
    },
    {
      id: 'notifyTransport',
      label: 'NOTIFY_TRANSPORT',
      ok: notifyTransport === 'smtp',
      blocking,
      detail: notifyTransport === 'smtp'
        ? 'SMTP delivery is enabled.'
        : `Using ${notifyTransport}. Hosted production must not fall back to log delivery.`,
    },
    {
      id: 'smtpUrl',
      label: 'SMTP_URL',
      ok: !!smtpUrl,
      blocking,
      detail: smtpUrl ? 'SMTP connection string is configured.' : 'Missing SMTP_URL.',
    },
    {
      id: 'r2AccountId',
      label: 'R2_ACCOUNT_ID',
      ok: !!r2AccountId,
      blocking,
      detail: r2AccountId ? 'R2 account id is configured.' : 'Missing R2_ACCOUNT_ID.',
    },
    {
      id: 'r2AccessKeyId',
      label: 'R2_ACCESS_KEY_ID',
      ok: !!r2AccessKeyId,
      blocking,
      detail: r2AccessKeyId ? 'R2 access key is configured.' : 'Missing R2_ACCESS_KEY_ID.',
    },
    {
      id: 'r2SecretAccessKey',
      label: 'R2_SECRET_ACCESS_KEY',
      ok: !!r2SecretAccessKey,
      blocking,
      detail: r2SecretAccessKey ? 'R2 secret key is configured.' : 'Missing R2_SECRET_ACCESS_KEY.',
    },
    {
      id: 'r2Bucket',
      label: 'R2_BUCKET',
      ok: !!r2Bucket,
      blocking,
      detail: r2Bucket ? 'R2 bucket is configured.' : 'Missing R2_BUCKET.',
    },
    {
      id: 'mediaBackend',
      label: 'Private media backend',
      ok: hasR2StorageConfig(),
      blocking,
      detail: hasR2StorageConfig()
        ? 'Private media is configured for R2-backed storage.'
        : 'The app will use local disk until R2 is configured.',
    },
    {
      id: 'upstashRestUrl',
      label: 'UPSTASH_REDIS_REST_URL',
      ok: !!upstashRestUrl,
      blocking,
      detail: upstashRestUrl ? 'Upstash REST URL is configured.' : 'Missing UPSTASH_REDIS_REST_URL.',
    },
    {
      id: 'upstashRestToken',
      label: 'UPSTASH_REDIS_REST_TOKEN',
      ok: !!upstashRestToken,
      blocking,
      detail: upstashRestToken ? 'Upstash REST token is configured.' : 'Missing UPSTASH_REDIS_REST_TOKEN.',
    },
    {
      id: 'rateLimitBackend',
      label: 'Distributed rate-limit backend',
      ok: hasUpstashRateLimitConfig(),
      blocking,
      detail: hasUpstashRateLimitConfig()
        ? 'Rate limiting is configured for Upstash-backed shared state.'
        : 'The app will use process memory until Upstash is configured.',
    },
  ]
}

const CAPABILITY_CHECKS: Record<RuntimeCapability, RuntimeCheckId[]> = {
  base: ['databaseUrl', 'sessionSecret', 'appUrl', 'publicAppUrl', 'appUrlParity', 'internalAutomationSecret'],
  notifications: ['notifyTransport', 'smtpUrl'],
  media: ['r2AccountId', 'r2AccessKeyId', 'r2SecretAccessKey', 'r2Bucket', 'mediaBackend'],
  rateLimit: ['upstashRestUrl', 'upstashRestToken', 'rateLimitBackend'],
}

export function getRuntimeFailures(capabilities: RuntimeCapability[]) {
  const checks = getRuntimeChecks()
  const required = new Set(capabilities.flatMap((capability) => CAPABILITY_CHECKS[capability]))
  return checks.filter((check) => required.has(check.id) && !check.ok)
}

export function assertHostedRuntimeReady(context: string, capabilities: RuntimeCapability[]) {
  if (!isHostedRuntimeEnforced()) return

  const failures = getRuntimeFailures(capabilities)
  if (!failures.length) return

  throw new Error(
    `Hosted runtime misconfigured for ${context}: ${failures.map((failure) => `${failure.label} — ${failure.detail}`).join(' | ')}`,
  )
}

export function getAppBaseUrl(context: string) {
  const appUrl = envValue('APP_URL')
  const publicAppUrl = envValue('NEXT_PUBLIC_APP_URL')

  if (appUrl && publicAppUrl && normalizedUrl(appUrl) !== normalizedUrl(publicAppUrl) && isHostedRuntimeEnforced()) {
    throw new Error(`Hosted runtime misconfigured for ${context}: APP_URL and NEXT_PUBLIC_APP_URL must match.`)
  }

  const selected = appUrl || publicAppUrl
  if (selected) return normalizedUrl(selected)

  if (isHostedRuntimeEnforced()) {
    throw new Error(`Hosted runtime misconfigured for ${context}: APP_URL or NEXT_PUBLIC_APP_URL must be set.`)
  }

  return 'http://localhost:3000'
}
