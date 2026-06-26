import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createVendorSession } from '@/lib/vendor-session'
import { verifyVendorOtpChallenge } from '@/lib/vendor-otp-lib'
import { writeAuditLog } from '@/lib/audit-log'

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url))
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const challengeId = searchParams.get('challengeId') ?? ''
  const code = searchParams.get('code') ?? ''
  const next = searchParams.get('next')
  const result = await verifyVendorOtpChallenge(challengeId, code)

  if (!result.ok) return redirectTo(request, '/vendor/auth/login?error=magic-link')

  await createVendorSession(result.vendorId)
  const vendor = await prisma.vendor.findUnique({ where: { id: result.vendorId }, select: { orgId: true } })
  await writeAuditLog({
    orgId: vendor?.orgId ?? null,
    actorUserId: null,
    entityType: 'vendor',
    entityId: result.vendorId,
    action: 'vendor.magicLoginCompleted',
    summary: 'Completed vendor sign-in through a secure one-tap link.',
    metadata: { challengeId },
  })

  return redirectTo(request, next?.startsWith('/vendor') ? next : '/vendor')
}
