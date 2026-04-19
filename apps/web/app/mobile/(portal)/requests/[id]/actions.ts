'use server'

import { revalidatePath } from 'next/cache'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { prisma } from '@/lib/prisma'

export type TenantRequestActionState = { error: string | null; success?: boolean }

export async function cancelTenantMobileRequestAction(
  _prev: TenantRequestActionState,
  formData: FormData,
): Promise<TenantRequestActionState> {
  const session = await requireTenantMobileSession()
  const requestId = String(formData.get('requestId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()

  if (!reason) return { error: 'Cancel reason is required.' }

  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      unitId: session.unitId,
      OR: [
        { tenantIdentityId: session.tenantIdentityId },
        ...(session.email ? [{ tenantIdentityId: null, submittedByEmail: session.email }] : []),
      ],
    },
    select: { id: true, status: true },
  })

  if (!request) return { error: 'Request not found.' }
  if (!['requested', 'approved', 'reopened'].includes(request.status)) {
    return { error: 'This request can no longer be canceled from the tenant portal.' }
  }

  await prisma.$transaction(async (tx) => {
    await tx.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status: 'canceled',
        cancelReason: reason,
        canceledByType: 'tenant',
        canceledByUserId: null,
        closedAt: new Date(),
      },
    })

    await tx.statusEvent.create({
      data: {
        requestId,
        fromStatus: request.status,
        toStatus: 'canceled',
        visibility: 'tenant_visible',
      },
    })

    await tx.requestComment.create({
      data: {
        requestId,
        body: `Tenant canceled request: ${reason}`,
        visibility: 'external',
      },
    })
  })

  revalidatePath(`/mobile/requests/${requestId}`)
  revalidatePath('/mobile')
  return { error: null, success: true }
}
