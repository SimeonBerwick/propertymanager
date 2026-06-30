import { NextRequest, NextResponse } from 'next/server'
import { hasUpstashRateLimitConfig } from '@/lib/runtime-env'
import { getRateLimitStatus, resetRateLimit, takeRateLimitHit } from '@/lib/rate-limit'

function isAuthorized(request: NextRequest) {
  const header = request.headers.get('authorization')
  return [process.env.INTERNAL_AUTOMATION_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .some((secret) => header === `Bearer ${secret}`)
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!hasUpstashRateLimitConfig()) {
    return NextResponse.json({ ok: false, error: 'Upstash rate-limit backend is not configured.' }, { status: 503 })
  }

  const proofId = crypto.randomUUID()
  const key = `runtime-proof:${proofId}`
  const policy = { limit: 2, windowMs: 60_000, blockMs: 60_000 }

  try {
    await resetRateLimit(key)
    const initial = await getRateLimitStatus(key, policy)
    const firstHit = await takeRateLimitHit(key, policy)
    const secondHit = await takeRateLimitHit(key, policy)
    const blockedStatus = await getRateLimitStatus(key, policy)

    return NextResponse.json({
      ok: true,
      backend: 'upstash',
      proofId,
      initial,
      firstHit,
      secondHit,
      blockedStatus,
      blocked: !secondHit.ok && !blockedStatus.ok,
    })
  } finally {
    await resetRateLimit(key).catch(() => undefined)
  }
}
