import { NextResponse } from 'next/server'
import { isDatabaseAvailable } from '@/lib/db-status'
import { getRuntimeFailures, isHostedRuntimeEnforced } from '@/lib/runtime-env'

export async function GET() {
  const database = await isDatabaseAvailable()
  const failures = isHostedRuntimeEnforced()
    ? getRuntimeFailures(['base', 'notifications', 'media', 'rateLimit', 'billing'])
    : []
  const ok = database && failures.length === 0

  return NextResponse.json({
    ok,
    service: 'property-manager-v1-web',
    database,
    capabilities: {
      notifications: !failures.some((failure) => ['notifyTransport', 'smtpUrl'].includes(failure.id)),
      media: !failures.some((failure) => failure.id.startsWith('r2') || failure.id === 'mediaBackend'),
      rateLimit: !failures.some((failure) => failure.id.includes('upstash') || failure.id === 'rateLimitBackend'),
      billing: !failures.some((failure) => failure.id.startsWith('stripe')),
    },
    failures: failures.map((failure) => ({ id: failure.id, label: failure.label })),
  }, { status: ok ? 200 : 503 })
}
