import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { consumeTenantInvite } from '@/lib/tenant-invite-lib'
import { createTenantMobileSession } from '@/lib/tenant-mobile-session'
import { verifyOtpChallenge } from '@/lib/tenant-otp-lib'
import { writeAuditLog } from '@/lib/audit-log'

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url))
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const challengeId = searchParams.get('challengeId') ?? ''
  const code = searchParams.get('code') ?? ''
  const inviteId = searchParams.get('inviteId')
  const next = searchParams.get('next')
  const result = await verifyOtpChallenge(challengeId, code)

  if (!result.ok) {
    return redirectTo(request, '/mobile/auth/login?error=magic-link')
  }

  if (inviteId) {
    const invite = await prisma.tenantInvite.findFirst({
      where: { id: inviteId, tenantIdentityId: result.tenantIdentityId, status: 'pending', revokedAt: null },
      select: { id: true },
    })
    if (!invite) return redirectTo(request, '/mobile/auth/login?error=magic-link')
    await prisma.tenantIdentity.update({
      where: { id: result.tenantIdentityId },
      data: { status: 'active', verifiedAt: new Date(), lastLoginAt: new Date() },
    })
    await consumeTenantInvite(invite.id)
  }

  await createTenantMobileSession(result.tenantIdentityId)
  const identity = await prisma.tenantIdentity.findUnique({
    where: { id: result.tenantIdentityId },
    select: { orgId: true },
  })
  await writeAuditLog({
    orgId: identity?.orgId ?? null,
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: result.tenantIdentityId,
    action: 'tenantIdentity.magicLoginCompleted',
    summary: 'Completed tenant sign-in through a secure one-tap link.',
    metadata: { challengeId, inviteId: inviteId ?? null },
  })

  return redirectTo(request, next?.startsWith('/mobile') ? next : '/mobile')
}
