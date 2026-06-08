import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentPushPrincipal } from '@/lib/push-principal'

type SubscriptionBody = {
  endpoint?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
}

export async function POST(request: Request) {
  const principal = await getCurrentPushPrincipal()
  if (!principal) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const body = await request.json().catch(() => null) as SubscriptionBody | null
  if (
    !body
    || typeof body.endpoint !== 'string'
    || typeof body.keys?.p256dh !== 'string'
    || typeof body.keys.auth !== 'string'
    || body.endpoint.length > 2000
  ) {
    return NextResponse.json({ error: 'Invalid push subscription.' }, { status: 400 })
  }

  const userAgent = (await headers()).get('user-agent')?.slice(0, 500) ?? null
  await prisma.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    create: {
      principalType: principal.type,
      principalId: principal.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent,
    },
    update: {
      principalType: principal.type,
      principalId: principal.id,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent,
    },
  })

  return NextResponse.json({ ok: true })
}
