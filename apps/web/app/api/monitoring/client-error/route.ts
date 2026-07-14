import { NextRequest, NextResponse } from 'next/server'
import { captureSentryException } from '@/lib/sentry-reporting'
import { takeRateLimitHit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const key = forwarded || request.headers.get('x-real-ip') || 'unknown'
  const limit = await takeRateLimitHit(`client-error:${key}`, { limit: 6, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 })
    .catch(() => ({ ok: true as const, remaining: 0 }))
  if (!limit.ok) return NextResponse.json({ accepted: false }, { status: 429 })

  const body = await request.json().catch(() => ({})) as { message?: unknown; digest?: unknown; path?: unknown }
  const message = typeof body.message === 'string' ? body.message.slice(0, 500) : 'Browser error'
  const path = typeof body.path === 'string' && body.path.startsWith('/') ? body.path.slice(0, 300) : undefined
  const digest = typeof body.digest === 'string' ? body.digest.slice(0, 100) : undefined
  const result = await captureSentryException(new Error(message), {
    area: 'browser.error-boundary',
    path,
    tags: { digest },
  })
  return NextResponse.json({ accepted: true, eventId: result.eventId })
}
