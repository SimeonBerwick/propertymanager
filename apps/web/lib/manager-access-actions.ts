'use server'

import { revalidatePath } from 'next/cache'
import { getLandlordSession } from '@/lib/landlord-session'
import { createTenantManagerAccessCode, createVendorManagerAccessCode } from '@/lib/manager-access-code'
import { getTenantDeliveryAdapter } from '@/lib/tenant-delivery'
import { getVendorDeliveryAdapter } from '@/lib/vendor-delivery'
import { prisma } from '@/lib/prisma'
import { getAppBaseUrl } from '@/lib/runtime-env'

export type ManagerAccessCodeState = {
  error: string | null
  code?: string
  expiresAt?: string
  scope?: string
}

function value(formData: FormData, key: string) {
  const item = formData.get(key)
  return typeof item === 'string' ? item.trim() : ''
}

function parseWindow(formData: FormData) {
  const rawStart = value(formData, 'validFrom')
  const durationHours = Number(value(formData, 'durationHours') || '24')
  const validFrom = rawStart ? new Date(rawStart) : new Date()
  if (Number.isNaN(validFrom.getTime())) throw new Error('Access start time is invalid.')
  if (![1, 4, 24, 72, 168].includes(durationHours)) throw new Error('Access duration is invalid.')
  if (validFrom.getTime() < Date.now() - 5 * 60 * 1000) throw new Error('Access start time cannot be in the past.')
  const expiresAt = new Date(validFrom.getTime() + durationHours * 60 * 60 * 1000)
  return { validFrom, expiresAt }
}

export async function createTenantAccessCodeAction(
  _previous: ManagerAccessCodeState,
  formData: FormData,
): Promise<ManagerAccessCodeState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  try {
    const { validFrom, expiresAt } = parseWindow(formData)
    const result = await createTenantManagerAccessCode({
      actorUserId: session.userId,
      tenantIdentityId: value(formData, 'tenantIdentityId'),
      validFrom,
      expiresAt,
    })
    await getTenantDeliveryAdapter().sendManagerAccessCode({
      to: result.email,
      code: result.code,
      tenantName: result.name,
      expiresAt: result.expiresAt,
      accessLink: `${getAppBaseUrl('tenant manager access codes')}/mobile/auth/login`,
    })
    revalidatePath('/access')
    return { error: null, code: result.code, expiresAt: result.expiresAt.toISOString(), scope: 'Tenant portal for this unit' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not create tenant access code.' }
  }
}

export async function createVendorAccessCodeAction(
  _previous: ManagerAccessCodeState,
  formData: FormData,
): Promise<ManagerAccessCodeState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  try {
    const { validFrom, expiresAt } = parseWindow(formData)
    const requestId = value(formData, 'requestId')
    const result = await createVendorManagerAccessCode({
      actorUserId: session.userId,
      vendorId: value(formData, 'vendorId'),
      requestId,
      validFrom,
      expiresAt,
    })
    const request = await prisma.maintenanceRequest.findUnique({ where: { id: requestId }, select: { title: true } })
    await getVendorDeliveryAdapter().sendManagerAccessCode({
      to: result.email,
      code: result.code,
      vendorName: result.name,
      requestTitle: request?.title ?? 'assigned work order',
      expiresAt: result.expiresAt,
      accessLink: `${getAppBaseUrl('vendor manager access codes')}/vendor/auth/login`,
    })
    revalidatePath('/access')
    return { error: null, code: result.code, expiresAt: result.expiresAt.toISOString(), scope: request?.title ?? 'Selected work order' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not create vendor access code.' }
  }
}
