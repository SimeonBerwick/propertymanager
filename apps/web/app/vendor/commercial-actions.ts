'use server'

import { revalidatePath } from 'next/cache'
import { requireVendorSession } from '@/lib/vendor-session'
import { prisma } from '@/lib/prisma'
import { centsFromDollars } from '@/lib/billing-utils'
import { writeAuditLog } from '@/lib/audit-log'
import { buildVendorRequestVisibilityWhere } from '@/lib/vendor-portal-data'
import { logServerActionError } from '@/lib/observability'

export type VendorCommercialActionState = { error: string | null; success?: boolean }

export async function createVendorCommercialItemAction(
  _prev: VendorCommercialActionState,
  formData: FormData,
): Promise<VendorCommercialActionState> {
  const session = await requireVendorSession()
  const requestId = String(formData.get('requestId') ?? '')
  const itemType = String(formData.get('itemType') ?? '')
  const amount = String(formData.get('amount') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  if (!requestId) return { error: 'Request is required.' }
  if (!['bid', 'service_fee', 'overcost', 'bill_to_property_manager'].includes(itemType)) return { error: 'Invalid submission type.' }
  if (!title) return { error: 'Title is required.' }

  const amountCents = centsFromDollars(amount)
  if (amountCents == null || amountCents <= 0) return { error: 'Valid USD amount is required.' }

  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      ...buildVendorRequestVisibilityWhere(session),
    },
    select: { id: true },
  })

  if (!request) return { error: 'This request is not available for your vendor account.' }

  try {
    const item = await prisma.vendorCommercialItem.create({
      data: {
        requestId: request.id,
        vendorId: session.vendorId,
        orgId: session.orgId ?? null,
        itemType: itemType as 'bid' | 'service_fee' | 'overcost' | 'bill_to_property_manager',
        currency: 'usd',
        amountCents,
        title,
        description: description || null,
      },
    })

    await writeAuditLog({
      orgId: session.orgId ?? null,
      actorUserId: null,
      entityType: 'vendorCommercialItem',
      entityId: item.id,
      action: 'vendorCommercialItem.created',
      summary: `Vendor submitted ${itemType} for request ${request.id}.`,
      metadata: { requestId: request.id, vendorId: session.vendorId, amountCents, title },
    })

    revalidatePath('/vendor')
    revalidatePath('/vendor/summary')
    revalidatePath(`/vendor/requests/${request.id}`)
    revalidatePath(`/requests/${request.id}`)
    return { error: null, success: true }
  } catch (error) {
    await logServerActionError('vendorCommercialItem.create', error, {
      requestId: request.id,
      vendorId: session.vendorId,
      itemType,
    })
    return { error: 'Could not save vendor commercial item.' }
  }
}
