'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { createTenantInvite, revokeAllInvitesAndSessionsForIdentity } from '@/lib/tenant-invite-lib'
import { getTenantDeliveryAdapter } from '@/lib/tenant-delivery'
import { normalizePhoneToE164 } from '@/lib/phone'

export type MobileIdentityState = {
  error: string | null
  inviteLink?: string
  success?: boolean
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePhone(raw: string): string {
  return normalizePhoneToE164(raw) ?? ''
}

export async function setupMobileIdentityAction(
  _prev: MobileIdentityState,
  formData: FormData,
): Promise<MobileIdentityState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  const unitId = getString(formData, 'unitId')
  const tenantName = getString(formData, 'tenantName')
  const phone = normalizePhone(getString(formData, 'phoneE164'))
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

    const invite = await createTenantInvite(tenantIdentityId, 'email')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const inviteLink = `${appUrl}/mobile/auth/accept/${invite.rawToken}`

    await getTenantDeliveryAdapter().sendInviteLink({
      to: invite.sentTo,
      channel: 'email',
      inviteLink,
      tenantName: tenantIdentity.tenantName,
    })

    revalidatePath('/units')
    return { error: null, success: true, inviteLink }
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

  await revokeAllInvitesAndSessionsForIdentity(tenantIdentityId)
  await prisma.tenantIdentity.update({
    where: { id: tenantIdentityId },
    data: { status: 'inactive' },
  })

  revalidatePath('/units')
  return { error: null, success: true }
}
