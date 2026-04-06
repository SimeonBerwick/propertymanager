'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { renderBillingPdfHtml } from '@/lib/billing-pdf'
import { centsFromDollars, deriveBillingStatus } from '@/lib/billing-utils'
import { sendNotification, type NotificationMessage } from '@/lib/notify'

export type BillingActionState = { error: string | null; success?: boolean }

function inferDocumentType(recipientType: string) {
  return recipientType === 'vendor' ? 'vendor_remittance' : 'tenant_invoice'
}

export async function createBillingDocumentAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  const requestId = String(formData.get('requestId') ?? '')
  const recipientType = String(formData.get('recipientType') ?? 'tenant')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const amountRaw = String(formData.get('amount') ?? '').trim()
  const paidRaw = String(formData.get('paidAmount') ?? '').trim()
  const sentTo = String(formData.get('sentTo') ?? '').trim()

  if (!['tenant', 'vendor'].includes(recipientType)) return { error: 'Invalid recipient type.' }
  if (!title) return { error: 'Title is required.' }

  const totalCents = centsFromDollars(amountRaw)
  const paidCents = paidRaw ? centsFromDollars(paidRaw) : 0
  if (totalCents === null) return { error: 'Invalid amount.' }
  if (paidCents === null) return { error: 'Invalid paid amount.' }
  if ((paidCents ?? 0) > totalCents) return { error: 'Paid amount cannot exceed total.' }

  try {
    const request = await prisma.maintenanceRequest.findFirst({
      where: { id: requestId, property: { ownerId: session.userId } },
      include: { property: true, unit: true },
    })
    if (!request) return { error: 'Request not found.' }

    const pdfHtml = renderBillingPdfHtml({
      title,
      recipientLabel: recipientType === 'tenant'
        ? (request.submittedByName || request.submittedByEmail || 'Tenant')
        : (request.assignedVendorName || 'Vendor'),
      documentType: inferDocumentType(recipientType),
      status: deriveBillingStatus(totalCents, paidCents ?? 0),
      amountCents: totalCents,
      paidCents: paidCents ?? 0,
      currency: request.preferredCurrency,
      description,
      requestTitle: request.title,
      propertyName: request.property.name,
      unitLabel: request.unit.label,
    })

    const billingDocument = await prisma.billingDocument.create({
      data: {
        requestId,
        recipientType: recipientType as 'tenant' | 'vendor',
        documentType: inferDocumentType(recipientType) as 'tenant_invoice' | 'vendor_remittance',
        status: deriveBillingStatus(totalCents, paidCents ?? 0) as 'sent' | 'partial' | 'paid',
        currency: request.preferredCurrency,
        totalCents,
        paidCents: paidCents ?? 0,
        title,
        description: description || null,
        pdfUrl: `data:text/html;charset=utf-8,${encodeURIComponent(pdfHtml)}`,
        sentTo: sentTo || null,
        sentAt: sentTo ? new Date() : null,
        createdByUserId: session.userId,
        events: {
          create: {
            actorUserId: session.userId,
            eventType: sentTo ? 'created_and_sent' : 'created',
            note: sentTo ? `Prepared for ${sentTo}` : 'Draft billing document created.',
          },
        },
      },
    })

    if (sentTo) {
      const msg: NotificationMessage = {
        to: sentTo,
        subject: title,
        text: `${title}\n\nThis document is attached in the operator record for request ${request.title}.\n\nAmount: ${(totalCents / 100).toFixed(2)}\nPaid: ${((paidCents ?? 0) / 100).toFixed(2)}`,
        html: pdfHtml,
      }
      await sendNotification(msg)
    }

    revalidatePath(`/requests/${requestId}`)
    return { error: null, success: true }
  } catch {
    return { error: 'Could not create billing document.' }
  }
}
