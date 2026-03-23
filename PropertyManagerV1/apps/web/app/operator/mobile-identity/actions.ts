'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createTenantInvite, revokeAllInvitesAndSessionsForIdentity } from '@/lib/tenant-invite-lib'

export type MobileIdentityState = {
  error: string | null
  inviteLink?: string
  success?: boolean
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePhone(raw: string) {
  const digits = raw.replace(/[^\d+]/g, '')
  if (!digits) return ''
  if (digits.startsWith('+')) return digits
  return `+1${digits}`
}

export async function setupMobileIdentityAction(
  _prev: MobileIdentityState,
  formData: FormData,
): Promise<MobileIdentityState> {
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
  const tenantIdentityId = getString(formData, 'tenantIdentityId')
  if (!tenantIdentityId) {
    return { error: 'Tenant mobile identity is required.' }
  }

  try {
    const invite = await createTenantInvite(tenantIdentityId, 'email')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const inviteLink = `${appUrl}/mobile/auth/accept/${invite.rawToken}`

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
  const tenantIdentityId = getString(formData, 'tenantIdentityId')
  if (!tenantIdentityId) {
    return { error: 'Tenant mobile identity is required.' }
  }

  await revokeAllInvitesAndSessionsForIdentity(tenantIdentityId)
  await prisma.tenantIdentity.update({
    where: { id: tenantIdentityId },
    data: { status: 'inactive' },
  })

  revalidatePath('/units')
  return { error: null, success: true }
}
