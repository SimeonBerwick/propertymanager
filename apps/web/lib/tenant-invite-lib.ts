import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit-log'

const INVITE_TTL_DAYS = 7

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function maskDestination(value: string) {
  if (!value) return ''
  if (value.includes('@')) {
    const [name, domain] = value.split('@')
    return `${name.slice(0, 2)}***@${domain}`
  }

  const tail = value.slice(-4)
  return `***${tail}`
}

export async function createTenantInvite(tenantIdentityId: string, sentVia: 'sms' | 'email' = 'email') {
  const tenantIdentity = await prisma.tenantIdentity.findUnique({ where: { id: tenantIdentityId } })

  if (!tenantIdentity) {
    throw new Error('Tenant identity not found.')
  }

  const destination = sentVia === 'sms' ? tenantIdentity.phoneE164 : (tenantIdentity.email ?? '')
  if (!destination) {
    throw new Error(`Tenant identity is missing a ${sentVia === 'sms' ? 'phone number' : 'delivery email'}.`)
  }

  const rawToken = randomBytes(24).toString('hex')
  const tokenHash = sha256(rawToken)

  const invite = await prisma.$transaction(async (tx) => {
    await tx.tenantInvite.updateMany({
      where: { tenantIdentityId, status: 'pending' },
      data: { status: 'revoked', revokedAt: new Date() },
    })

    return tx.tenantInvite.create({
      data: {
        tenantIdentityId,
        orgId: tenantIdentity.orgId,
        propertyId: tenantIdentity.propertyId,
        unitId: tenantIdentity.unitId,
        tokenHash,
        expiresAt: addDays(new Date(), INVITE_TTL_DAYS),
        sentVia,
        sentTo: destination,
      },
    })
  })

  await writeAuditLog({
    orgId: tenantIdentity.orgId,
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: tenantIdentity.id,
    action: 'tenantIdentity.inviteGenerated',
    summary: `Generated ${sentVia} invite for ${tenantIdentity.tenantName}.`,
    metadata: { inviteId: invite.id, sentVia, sentTo: destination },
  })

  return {
    inviteId: invite.id,
    rawToken,
    sentTo: destination,
    sentToMasked: maskDestination(destination),
    expiresAt: invite.expiresAt,
  }
}

export type InviteValidationResult =
  | {
      ok: true
      inviteId: string
      tenantIdentityId: string
      orgId: string
      propertyId: string
      unitId: string
      tenantName: string
      destinationMasked: string
    }
  | { ok: false; code: 'invalid' | 'expired' | 'revoked' | 'inactive' }

export async function validateTenantInviteToken(rawToken: string): Promise<InviteValidationResult> {
  if (!rawToken) {
    return { ok: false, code: 'invalid' }
  }

  const invite = await prisma.tenantInvite.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { tenantIdentity: true },
  })

  if (!invite) {
    return { ok: false, code: 'invalid' }
  }

  if (invite.status === 'revoked') {
    return { ok: false, code: 'revoked' }
  }

  if (invite.status !== 'pending') {
    return { ok: false, code: 'invalid' }
  }

  if (invite.expiresAt <= new Date()) {
    await prisma.tenantInvite.update({
      where: { id: invite.id },
      data: { status: 'expired' },
    })
    await writeAuditLog({
      orgId: invite.orgId,
      actorUserId: null,
      entityType: 'tenantIdentity',
      entityId: invite.tenantIdentityId,
      action: 'tenantIdentity.inviteExpired',
      summary: 'Tenant invite expired before acceptance.',
      metadata: { inviteId: invite.id },
    })
    return { ok: false, code: 'expired' }
  }

  if (invite.tenantIdentity.status === 'inactive' || invite.tenantIdentity.status === 'moved_out') {
    return { ok: false, code: 'inactive' }
  }

  return {
    ok: true,
    inviteId: invite.id,
    tenantIdentityId: invite.tenantIdentityId,
    orgId: invite.orgId,
    propertyId: invite.propertyId,
    unitId: invite.unitId,
    tenantName: invite.tenantIdentity.tenantName,
    destinationMasked: maskDestination(invite.sentTo),
  }
}

export async function consumeTenantInvite(inviteId: string) {
  const invite = await prisma.tenantInvite.update({
    where: { id: inviteId },
    data: { status: 'accepted', acceptedAt: new Date() },
  })

  await writeAuditLog({
    orgId: invite.orgId,
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: invite.tenantIdentityId,
    action: 'tenantIdentity.inviteAccepted',
    summary: 'Tenant invite accepted.',
    metadata: { inviteId },
  })
}

export async function revokeAllInvitesAndSessionsForIdentity(tenantIdentityId: string) {
  const tenantIdentity = await prisma.tenantIdentity.findUnique({ where: { id: tenantIdentityId }, select: { orgId: true } })

  await prisma.$transaction(async (tx) => {
    await tx.tenantInvite.updateMany({
      where: { tenantIdentityId, status: 'pending' },
      data: { status: 'revoked', revokedAt: new Date() },
    })
    await tx.tenantSession.updateMany({
      where: { tenantIdentityId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  })

  await writeAuditLog({
    orgId: tenantIdentity?.orgId ?? null,
    actorUserId: null,
    entityType: 'tenantIdentity',
    entityId: tenantIdentityId,
    action: 'tenantIdentity.accessRevoked',
    summary: 'Revoked pending invites and active sessions for tenant identity.',
  })
}
