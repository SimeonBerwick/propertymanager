'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { getLandlordSession } from '@/lib/landlord-session'
import { createTenantInvite } from '@/lib/tenant-invite-lib'
import { getTenantDeliveryAdapter } from '@/lib/tenant-delivery'
import { normalizePhoneToE164, type CountryCode } from '@/lib/phone'
import { writeAuditLog } from '@/lib/audit-log'
import { getUnitOccupancySnapshot, isTenantIdentityActiveOn } from '@/lib/tenant-occupancy'

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

function parseDateInput(raw: string) {
  if (!raw) return null
  const date = new Date(`${raw}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

async function syncUnitOccupancySnapshot(unitId: string) {
  const identities = await prisma.tenantIdentity.findMany({
    where: { unitId, status: { not: 'moved_out' } },
    orderBy: [{ leaseStartDate: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      tenantName: true,
      email: true,
      status: true,
      createdAt: true,
      leaseStartDate: true,
      leaseEndDate: true,
    },
  })

  const snapshot = getUnitOccupancySnapshot(identities)
  await prisma.unit.update({
    where: { id: unitId },
    data: {
      tenantName: snapshot.current?.tenantName ?? null,
      tenantEmail: snapshot.current?.email ?? null,
    },
  })
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
  const rawPhone = getString(formData, 'phoneE164')
  const phone = normalizePhone(rawPhone, phoneRegion)
  const email = getString(formData, 'email').toLowerCase() || null
  const tenantIdentityId = getString(formData, 'tenantIdentityId')
  const createMode = getString(formData, 'createMode') || 'current'
  const rawLeaseStartDate = getString(formData, 'leaseStartDate')
  const rawLeaseEndDate = getString(formData, 'leaseEndDate')
  const leaseStartDate = parseDateInput(rawLeaseStartDate) ?? (createMode === 'future' ? null : new Date())
  const leaseEndDate = parseDateInput(rawLeaseEndDate)

  if (createMode === 'future' && !tenantIdentityId) {
    const hasAnyFutureField = Boolean(tenantName || rawPhone || email || rawLeaseStartDate || rawLeaseEndDate)
    if (!hasAnyFutureField) {
      return { error: null, success: true }
    }

    if (!tenantName || !phone || !leaseStartDate) {
      return { error: 'Next renter setup is optional. If you add one, name, phone, and lease start date are required.' }
    }
  }

  if (!unitId || !tenantName || !phone || !leaseStartDate) {
    return { error: 'Unit, tenant name, phone, and lease start date are required.' }
  }

  if (leaseEndDate && leaseEndDate < leaseStartDate) {
    return { error: 'Lease end date cannot be earlier than lease start date.' }
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

  try {
    const editedIdentityId = await prisma.$transaction(async (tx) => {
    const existingIdentities = await tx.tenantIdentity.findMany({
      where: {
        orgId: unit.property.ownerId,
        propertyId: unit.propertyId,
        unitId: unit.id,
        status: { not: 'moved_out' },
      },
      orderBy: { createdAt: 'asc' },
    })

    const targetIdentity = tenantIdentityId
      ? existingIdentities.find((identity) => identity.id === tenantIdentityId)
      : createMode !== 'future'
        ? existingIdentities.find((identity) => isTenantIdentityActiveOn(identity) || identity.status === 'pending_invite')
        : null

    const overlaps = existingIdentities.some((identity) => {
      if (targetIdentity && identity.id === targetIdentity.id) return false
      if (identity.status === 'inactive') return false
      const existingStart = identity.leaseStartDate ?? identity.createdAt
      const existingEnd = identity.leaseEndDate
      const newEnd = leaseEndDate
      return existingStart <= (newEnd ?? new Date('9999-12-31T00:00:00Z'))
          && leaseStartDate <= (existingEnd ?? new Date('9999-12-31T00:00:00Z'))
      })

    if (overlaps) {
      throw new Error('Lease dates overlap an existing renter window on this unit. Adjust the dates or update the existing renter instead.')
    }

    if (tenantIdentityId && !targetIdentity) {
      throw new Error('Tenant identity not found for this unit.')
    }

      if (targetIdentity) {
        const nextStatus = tenantIdentityId
          && targetIdentity.status === 'active'
          && isTenantIdentityActiveOn({
            ...targetIdentity,
            leaseStartDate,
            leaseEndDate,
          })
          ? 'active'
          : 'pending_invite'
        await tx.tenantIdentity.update({
          where: { id: targetIdentity.id },
          data: {
            tenantName,
            phoneE164: phone,
            email,
            propertyId: unit.propertyId,
            leaseStartDate,
            leaseEndDate,
            status: nextStatus,
          },
        })
        return targetIdentity.id
      }

      const created = await tx.tenantIdentity.create({
        data: {
          orgId: unit.property.ownerId,
          propertyId: unit.propertyId,
          unitId: unit.id,
          tenantName,
          phoneE164: phone,
          email,
          leaseStartDate,
          leaseEndDate,
          status: 'pending_invite',
        },
      })

      return created.id
    })

    await syncUnitOccupancySnapshot(unit.id)

    await writeAuditLog({
      orgId: session.userId,
      actorUserId: session.userId,
      entityType: 'tenantIdentity',
      entityId: editedIdentityId,
      action: 'tenantIdentity.setup',
      summary: `Configured mobile identity for ${tenantName}.`,
      metadata: {
        unitId: unit.id,
        phoneE164: phone,
        email,
        leaseStartDate: leaseStartDate.toISOString(),
        leaseEndDate: leaseEndDate?.toISOString() ?? null,
        createMode,
      },
    })

    revalidatePath(`/units/${unit.id}`)
    revalidatePath('/access')
    return { error: null, success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save renter occupancy.' }
  }
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

    if (!isTenantIdentityActiveOn(tenantIdentity)) {
      return { error: 'This renter is outside the active lease window. Invite them on the lease start date or update the lease dates first.' }
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
    const appUrl = getAppBaseUrl('tenant invite links')
    const inviteLink = `${appUrl}/mobile/auth/accept/${invite.rawToken}`

    const delivery = await getTenantDeliveryAdapter().sendInviteLink({
      to: invite.sentTo,
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

  await syncUnitOccupancySnapshot(tenantIdentity.unitId)

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
  revalidatePath('/access')
  return { error: null, success: true }
}
