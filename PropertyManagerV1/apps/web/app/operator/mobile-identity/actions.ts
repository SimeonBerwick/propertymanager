'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { createTenantInvite } from '@/lib/tenant-invite-lib'
import { getTenantDeliveryAdapter } from '@/lib/tenant-delivery'
import { normalizePhoneToE164, type CountryCode } from '@/lib/phone'
import { writeAuditLog } from '@/lib/audit-log'

export type MobileIdentityState = {
  error: string | null
  inviteLink?: string
  success?: boolean
  /** Set when the invite was created but the delivery transport reported a failure. */
  deliveryWarning?: string
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePhone(raw: string, region?: string): string {
  return normalizePhoneToE164(raw, (region as CountryCode) || 'US') ?? ''
}

export async function setupMobileIdentityAction(
  _prev: MobileIdentityState,
  formData: FormData,
): Promise<MobileIdentityState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  const unitId = getString(formData, 'unitId')
  const tenantName = getString(formData, 'tenantName')
  const phoneRegion = getString(formData, 'phoneRegion') || 'US'
  const phone = normalizePhone(getString(formData, 'phoneE164'), phoneRegion)
  const email = getString(formData, 'email').toLowerCase() || null

  if (!unitId || !tenantName || !phone) {
    return { error: 'Unit, tenant name, and phone are required.' }
  }

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { property: true },
  })

  if (!unit) {
    return { error: 'Unit not found.' }
  }

  // Verify the unit belongs to the logged-in landlord's org.
  if (unit.property.ownerId !== session.userId) {
    return { error: 'Unit not found.' }
  }

  if (!unit.property.isActive || !unit.isActive) {
    return { error: 'Archived units cannot receive new mobile identity setup. Restore the unit first.' }
  }

  await prisma.tenantIdentity.upsert({
    where: {
      orgId_phoneE164_unitId: {
        orgId: unit.property.ownerId,
        phoneE164: phone,
        unitId: unit.id,
      },
    },
    update: {
      tenantName,
      phoneE164: phone,
      email,
      propertyId: unit.propertyId,
      status: 'pending_invite',
    },
    create: {
      orgId: unit.property.ownerId,
      propertyId: unit.propertyId,
      unitId: unit.id,
      tenantName,
      phoneE164: phone,
      email,
      status: 'pending_invite',
    },
  })

  await prisma.unit.update({
    where: { id: unit.id },
    data: {
      tenantName,
      tenantEmail: email,
    },
  })

  await writeAuditLog({
    orgId: session.userId,
      actorUserId: session.userId,
    entityType: 'tenantIdentity',
    entityId: unit.id,
    action: 'tenantIdentity.setup',
    summary: `Configured mobile identity for ${tenantName}.`,
    metadata: { unitId: unit.id, phoneE164: phone, email },
  })

  revalidatePath(`/units/${unit.id}`)
  return { error: null, success: true }
}

export async function sendMobileInviteAction(
  _prev: MobileIdentityState,
  formData: FormData,
): Promise<MobileIdentityState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  const tenantIdentityId = getString(formData, 'tenantIdentityId')
  if (!tenantIdentityId) {
    return { error: 'Tenant mobile identity is required.' }
  }

  try {
    const tenantIdentity = await prisma.tenantIdentity.findUnique({ where: { id: tenantIdentityId } })

    if (!tenantIdentity || tenantIdentity.orgId !== session.userId) {
      return { error: 'Tenant identity not found.' }
    }

    const unit = await prisma.unit.findFirst({
      where: {
        id: tenantIdentity.unitId,
        propertyId: tenantIdentity.propertyId,
        isActive: true,
        property: { ownerId: session.userId, isActive: true },
      },
      select: { id: true },
    })

    if (!unit) {
      return { error: 'Archived units cannot receive mobile invites. Restore the unit first.' }
    }

    const invite = await createTenantInvite(tenantIdentityId, 'email')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const inviteLink = `${appUrl}/mobile/auth/accept/${invite.rawToken}`

    const delivery = await getTenantDeliveryAdapter().sendInviteLink({
      to: invite.sentTo,
      channel: 'email',
      inviteLink,
      tenantName: tenantIdentity.tenantName,
    })

    await writeAuditLog({
      orgId: session.userId,
      actorUserId: session.userId,
      entityType: 'tenantIdentity',
      entityId: tenantIdentity.id,
      action: 'tenantIdentity.inviteCreated',
      summary: `Created mobile invite for ${tenantIdentity.tenantName}.`,
      metadata: { sentTo: invite.sentTo },
    })

    revalidatePath('/units')
    return {
      error: null,
      success: true,
      inviteLink,
      ...(!delivery.delivered && {
        deliveryWarning: `Invite link created but could not be delivered to ${invite.sentTo}. Copy the link above and send it manually.`,
      }),
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not send mobile invite.' }
  }
}

export async function deactivateMobileIdentityAction(
  _prev: MobileIdentityState,
  formData: FormData,
): Promise<MobileIdentityState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  const tenantIdentityId = getString(formData, 'tenantIdentityId')
  if (!tenantIdentityId) {
    return { error: 'Tenant mobile identity is required.' }
  }

  const tenantIdentity = await prisma.tenantIdentity.findUnique({ where: { id: tenantIdentityId } })
  if (!tenantIdentity || tenantIdentity.orgId !== session.userId) {
    return { error: 'Tenant identity not found.' }
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenantInvite.updateMany({
      where: { tenantIdentityId, status: 'pending' },
      data: { status: 'revoked', revokedAt: new Date() },
    })
    await tx.tenantSession.updateMany({
      where: { tenantIdentityId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    await tx.tenantIdentity.update({
      where: { id: tenantIdentityId },
      data: { status: 'inactive' },
    })
  })

  await writeAuditLog({
    orgId: session.userId,
      actorUserId: session.userId,
    entityType: 'tenantIdentity',
    entityId: tenantIdentity.id,
    action: 'tenantIdentity.deactivated',
    summary: `Deactivated mobile identity for ${tenantIdentity.tenantName}.`,
    metadata: { unitId: tenantIdentity.unitId },
  })

  revalidatePath('/units')
  return { error: null, success: true }
}
