'use server'

import { revalidatePath } from 'next/cache'
import { requireVendorSession } from '@/lib/vendor-session'
import { prisma } from '@/lib/prisma'
import { centsFromDollars } from '@/lib/billing-utils'
import { writeAuditLog } from '@/lib/audit-log'
import { buildVendorRequestVisibilityWhere } from '@/lib/vendor-portal-data'
import { logServerActionError } from '@/lib/observability'
import { cleanupVendorAttachment, saveVendorAttachment, validateVendorAttachment } from '@/lib/vendor-commercial-attachment-upload'

export type VendorCommercialActionState = { error: string | null; success?: boolean; message?: string }

type VendorCommercialItemType = 'bid' | 'service_fee' | 'overcost' | 'bill_to_property_manager'

function isAttachmentColumnError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('attachmentUrl')
    || message.includes('attachmentName')
    || message.includes('attachmentContentType')
    || message.includes('P2022')
}

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
  const attachmentFile = formData.get('attachment')
  const attachment = attachmentFile instanceof File && attachmentFile.size > 0 ? attachmentFile : null

  if (!requestId) return { error: 'Request is required.' }
  if (!['bid', 'service_fee', 'overcost', 'bill_to_property_manager'].includes(itemType)) return { error: 'Invalid submission type.' }
  if (!title) return { error: 'Title is required.' }

  const amountCents = centsFromDollars(amount)
  if (amountCents == null || amountCents <= 0) return { error: 'Valid USD amount is required.' }
  const attachmentError = await validateVendorAttachment(attachment)
  if (attachmentError) return { error: attachmentError }

  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      ...buildVendorRequestVisibilityWhere(session),
    },
    select: { id: true },
  })

  if (!request) return { error: 'This request is not available for your vendor account.' }

  let savedAttachment = await saveVendorAttachment(attachment)

  try {
    const attachmentData = savedAttachment
      ? {
          attachmentUrl: savedAttachment.url,
          attachmentName: savedAttachment.name,
          attachmentContentType: savedAttachment.contentType,
        }
      : {}

    const item = await prisma.vendorCommercialItem.create({
      data: {
        requestId: request.id,
        vendorId: session.vendorId,
        orgId: session.orgId ?? null,
        itemType: itemType as VendorCommercialItemType,
        currency: 'usd',
        amountCents,
        title,
        description: description || null,
        ...attachmentData,
      },
      select: { id: true },
    })

    await writeAuditLog({
      orgId: session.orgId ?? null,
      actorUserId: null,
      entityType: 'vendorCommercialItem',
      entityId: item.id,
      action: 'vendorCommercialItem.created',
      summary: `Vendor submitted ${itemType} for request ${request.id}.`,
      metadata: { requestId: request.id, vendorId: session.vendorId, amountCents, title, hasAttachment: Boolean(savedAttachment) },
    })

    revalidatePath('/vendor')
    revalidatePath('/vendor/summary')
    revalidatePath(`/vendor/requests/${request.id}`)
    revalidatePath(`/requests/${request.id}`)
    return { error: null, success: true }
  } catch (error) {
    if (savedAttachment && isAttachmentColumnError(error)) {
      const droppedAttachment = savedAttachment
      savedAttachment = null
      await cleanupVendorAttachment(droppedAttachment)

      try {
        const item = await prisma.vendorCommercialItem.create({
          data: {
            requestId: request.id,
            vendorId: session.vendorId,
            orgId: session.orgId ?? null,
            itemType: itemType as VendorCommercialItemType,
            currency: 'usd',
            amountCents,
            title,
            description: [
              description || null,
              `Bill attachment could not be linked by the app. Vendor tried to attach: ${droppedAttachment.name}.`,
            ].filter(Boolean).join('\n\n'),
          },
          select: { id: true },
        })

        await writeAuditLog({
          orgId: session.orgId ?? null,
          actorUserId: null,
          entityType: 'vendorCommercialItem',
          entityId: item.id,
          action: 'vendorCommercialItem.created',
          summary: `Vendor submitted ${itemType} for request ${request.id}; attachment link was skipped.`,
          metadata: { requestId: request.id, vendorId: session.vendorId, amountCents, title, attachmentSkipped: true },
        })

        await logServerActionError('vendorCommercialItem.create.attachmentColumnsMissing', error, {
          requestId: request.id,
          vendorId: session.vendorId,
          itemType,
        })

        revalidatePath('/vendor')
        revalidatePath('/vendor/summary')
        revalidatePath(`/vendor/requests/${request.id}`)
        revalidatePath(`/requests/${request.id}`)
        return {
          error: null,
          success: true,
          message: 'Charge submitted. The bill photo could not be attached, so the property manager may ask for the photo again.',
        }
      } catch (retryError) {
        await logServerActionError('vendorCommercialItem.create.retryWithoutAttachment', retryError, {
          requestId: request.id,
          vendorId: session.vendorId,
          itemType,
        })
      }
    }

    await cleanupVendorAttachment(savedAttachment)
    await logServerActionError('vendorCommercialItem.create', error, {
      requestId: request.id,
      vendorId: session.vendorId,
      itemType,
    })
    return { error: 'Could not save vendor invoice item.' }
  }
}
