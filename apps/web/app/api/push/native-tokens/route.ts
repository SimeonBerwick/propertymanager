import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentPushPrincipal } from '@/lib/push-principal'

type NativeTokenBody = {
  token?: unknown
  platform?: unknown
}

export async function POST(request: Request) {
  const principal = await getCurrentPushPrincipal()
  if (!principal) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const body = await request.json().catch(() => null) as NativeTokenBody | null
  if (
    !body
    || typeof body.token !== 'string'
    || body.token.length < 20
    || body.token.length > 4096
    || body.platform !== 'android'
  ) {
    return NextResponse.json({ error: 'Invalid native push token.' }, { status: 400 })
  }

  const userAgent = (await headers()).get('user-agent')?.slice(0, 500) ?? null
  await prisma.nativePushToken.upsert({
    where: { token: body.token },
    create: {
      principalType: principal.type,
      principalId: principal.id,
      token: body.token,
      platform: body.platform,
      userAgent,
    },
    update: {
      principalType: principal.type,
      principalId: principal.id,
      platform: body.platform,
      userAgent,
    },
  })

  return NextResponse.json({ ok: true })
}
