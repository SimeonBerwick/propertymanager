'use server'

import { revalidatePath } from 'next/cache'
import { BillingDocumentStatus as PrismaBillingDocumentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { renderBillingPdfHtml } from '@/lib/billing-pdf'
import { centsFromDollars, deriveBillingStatus, formatMoney } from '@/lib/billing-utils'
import { buildBillingDocumentMessage, sendNotification } from '@/lib/notify'
import type { BillingDocumentStatus } from '@/lib/billing-types'
import { writeAuditLog } from '@/lib/audit-log'
import { logServerActionError } from '@/lib/observability'
import { getAppBaseUrl } from '@/lib/runtime-env'

export type BillingActionState = { error: string | null; success?: boolean }

function inferDocumentType(recipientType: string) {
  return recipientType === 'vendor' ? 'vendor_remittance' : 'tenant_invoice'
}

function billingActionUrl(recipientType: string, requestId: string) {
  const baseUrl = getAppBaseUrl('billing notification links')
  return recipientType === 'tenant'
    ? `${baseUrl}/mobile/requests/${requestId}#charges`
    : `${baseUrl}/vendor/requests/${requestId}`
}

async function getOwnedBillingDocument(sessionUserId: string, billingDocumentId: string, requestId: string) {
  return prisma.billingDocument.findFirst({
    where: {
      id: billingDocumentId,
      requestId,
      request: { property: { ownerId: sessionUserId } },
    },
    include: {
      request: {
        include: {
          property: true,
          unit: true,
        },
      },
    },
  })
}


async function closeCompletedRequestIfFullySettled(requestId: string, userId: string) {
  const request = await prisma.maintenanceRequest.findFirst({
    where: { id: requestId, property: { ownerId: userId } },
    select: {
      id: true,
      status: true,
      reviewState: true,
      billingDocuments: {
        select: { status: true, totalCents: true, paidCents: true },
      },
      vendorCommercialItems: {
        where: { status: 'submitted' },
        select: { id: true },
      },
    },
  })

  if (!request) return false
  if (request.status !== 'completed' || request.reviewState !== 'vendor_completed_pending_review') return false
  if (request.vendorCommercialItems.length > 0) return false

  const activeDocuments = request.billingDocuments.filter((document) => document.status !== 'void')
  if (!activeDocuments.length) return false
  const allPaid = activeDocuments.every((document) => document.status === 'paid' && document.paidCents >= document.totalCents)
  if (!allPaid) return false

  await prisma.$transaction([
    prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status: 'closed',
        closedAt: new Date(),
        reviewState: 'approved',
        reviewNote: 'Automatically closed after completion and billing were fully paid.',
        autoFlag: null,
        autoFlaggedAt: null,
      },
    }),
    prisma.statusEvent.create({
      data: { requestId, fromStatus: 'completed', toStatus: 'closed', actorUserId: userId },
    }),
  ])

  await writeAuditLog({
    actorUserId: userId,
    entityType: 'request',
    entityId: requestId,
    action: 'request.autoClosedAfterBillingSettled',
    summary: 'Automatically closed completed request after all active billing documents were paid.',
    metadata: { requestId },
  })

  return true
}

async function notifyBillingRecipient({
  to,
  title,
  recipientLabel,
  documentType,
  status,
  totalCents,
  paidCents,
  currency,
  ownerUserId,
  requestId,
  actionUrl,
}: {
  to: string
  title: string
  recipientLabel: string
  documentType: 'tenant_invoice' | 'vendor_remittance'
  status: BillingDocumentStatus
  totalCents: number
  paidCents: number
  currency: 'usd' | 'peso' | 'pound' | 'euro'
  ownerUserId: string
  requestId: string
  actionUrl?: string
}) {
  const result = await sendNotification(buildBillingDocumentMessage({
    to,
    title,
    recipientLabel,
    documentType,
    status,
    amountLabel: formatMoney(totalCents, currency),
    paidLabel: formatMoney(paidCents, currency),
    balanceLabel: formatMoney(totalCents - paidCents, currency),
    actionUrl,
  }), { ownerUserId, requestId, bypassUserPreference: true })
  return result.ok
}

export async function createBillingDocumentAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const requestId = String(formData.get('requestId') ?? '')
  const recipientType = String(formData.get('recipientType') ?? 'tenant')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const amountRaw = String(formData.get('amount') ?? '').trim()
  const paidRaw = String(formData.get('paidAmount') ?? '').trim()
  const sendMode = String(formData.get('sendMode') ?? 'send')
  const sentTo = sendMode === 'send' ? String(formData.get('sentTo') ?? '').trim() : ''

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

    const status = (sendMode === 'draft' ? 'draft' : deriveBillingStatus(totalCents, paidCents ?? 0)) as 'draft' | 'sent' | 'partial' | 'paid'
    const pdfHtml = renderBillingPdfHtml({
      title,
      recipientLabel: recipientType === 'tenant'
        ? (request.submittedByName || request.submittedByEmail || 'Tenant')
        : (request.assignedVendorName || 'Vendor'),
      documentType: inferDocumentType(recipientType),
      status,
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
        status,
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

    await writeAuditLog({
            actorUserId: session.userId,
      entityType: 'billingDocument',
      entityId: billingDocument.id,
      action: 'billingDocument.created',
      summary: `Created ${recipientType} billing document ${title}.`,
      metadata: { requestId, status, sentTo: sentTo || null, totalCents, paidCents: paidCents ?? 0 },
    })

    if (sentTo) {
      const delivered = await notifyBillingRecipient({
        to: sentTo,
        title,
        recipientLabel: recipientType === 'tenant'
          ? (request.submittedByName || request.submittedByEmail || 'Tenant')
          : (request.assignedVendorName || 'Vendor'),
        documentType: inferDocumentType(recipientType),
        status,
        totalCents,
        paidCents: paidCents ?? 0,
        currency: request.preferredCurrency,
        ownerUserId: session.userId,
        requestId,
        actionUrl: billingActionUrl(recipientType, requestId),
      })
      if (!delivered) {
        await prisma.billingDocument.update({
          where: { id: billingDocument.id },
          data: {
            status: 'draft',
            sentAt: null,
            events: {
              create: {
                actorUserId: session.userId,
                eventType: 'email_delivery_failed',
                note: `Email delivery failed for ${sentTo}. Use Resend after checking the address and email settings.`,
              },
            },
          },
        })
        revalidatePath(`/requests/${requestId}`)
        return { error: `Billing document was saved, but email was not delivered to ${sentTo}. Use Resend after checking the address and email settings.` }
      }
    }

    await closeCompletedRequestIfFullySettled(requestId, session.userId)
    revalidatePath(`/requests/${requestId}`)
    revalidatePath('/dashboard')
    return { error: null, success: true }
  } catch (error) {
    await logServerActionError('billing.create', error, { requestId, recipientType })
    return { error: 'Could not create billing document.' }
  }
}

export async function updateBillingDocumentAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const billingDocumentId = String(formData.get('billingDocumentId') ?? '')
  const requestId = String(formData.get('requestId') ?? '')
  const paidRaw = String(formData.get('paidAmount') ?? '').trim()
  const paidCents = centsFromDollars(paidRaw)
  if (paidCents === null) return { error: 'Invalid paid amount.' }

  try {
    const doc = await getOwnedBillingDocument(session.userId, billingDocumentId, requestId)
    if (!doc) return { error: 'Billing document not found.' }
    if (paidCents > doc.totalCents) return { error: 'Paid amount cannot exceed total.' }

    const status = deriveBillingStatus(doc.totalCents, paidCents) as 'sent' | 'partial' | 'paid'

    await prisma.billingDocument.update({
      where: { id: billingDocumentId },
      data: {
        paidCents,
        status,
        events: {
          create: {
            actorUserId: session.userId,
            eventType: 'payment_state_updated',
            note: `Paid amount updated to ${paidRaw || '0.00'}`,
          },
        },
      },
    })

    await writeAuditLog({
            actorUserId: session.userId,
      entityType: 'billingDocument',
      entityId: billingDocumentId,
      action: 'billingDocument.paymentUpdated',
      summary: `Updated billing payment state to ${status}.`,
      metadata: { requestId, paidCents, totalCents: doc.totalCents },
    })

    if (doc.sentTo) {
      await notifyBillingRecipient({
        to: doc.sentTo,
        title: doc.title,
        recipientLabel: doc.recipientType === 'tenant'
          ? (doc.request.submittedByName || doc.request.submittedByEmail || 'Tenant')
          : (doc.request.assignedVendorName || 'Vendor'),
        documentType: doc.documentType,
        status,
        totalCents: doc.totalCents,
        paidCents,
        currency: doc.currency,
        ownerUserId: session.userId,
        requestId,
        actionUrl: billingActionUrl(doc.recipientType, requestId),
      })
    }

    await closeCompletedRequestIfFullySettled(requestId, session.userId)
    revalidatePath(`/requests/${requestId}`)
    revalidatePath('/dashboard')
    revalidatePath('/vendor')
    revalidatePath(`/vendor/requests/${requestId}`)
    return { error: null, success: true }
  } catch (error) {
    await logServerActionError('billing.update', error, { requestId, billingDocumentId })
    return { error: 'Could not update billing document.' }
  }
}

export async function markBillingDocumentPaidFromDashboardAction(formData: FormData): Promise<void> {
  await updateBillingDocumentAction({ error: null }, formData)
}

export async function resendBillingDocumentAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const billingDocumentId = String(formData.get('billingDocumentId') ?? '')
  const requestId = String(formData.get('requestId') ?? '')

  try {
    const doc = await getOwnedBillingDocument(session.userId, billingDocumentId, requestId)
    if (!doc) return { error: 'Billing document not found.' }
    const currentStatus = doc.status as BillingDocumentStatus
    if (currentStatus === 'void') return { error: 'Void documents cannot be resent.' }
    if (!doc.sentTo) return { error: 'This document has no recipient to resend to.' }

    const nextStatus = (currentStatus === 'draft'
      ? deriveBillingStatus(doc.totalCents, doc.paidCents)
      : currentStatus) as BillingDocumentStatus

    const delivered = await notifyBillingRecipient({
      to: doc.sentTo,
      title: doc.title,
      recipientLabel: doc.recipientType === 'tenant'
        ? (doc.request.submittedByName || doc.request.submittedByEmail || 'Tenant')
        : (doc.request.assignedVendorName || 'Vendor'),
      documentType: doc.documentType,
      status: nextStatus,
      totalCents: doc.totalCents,
      paidCents: doc.paidCents,
      currency: doc.currency,
      ownerUserId: session.userId,
      requestId,
      actionUrl: billingActionUrl(doc.recipientType, requestId),
    })
    if (!delivered) {
      await prisma.billingDocument.update({
        where: { id: doc.id },
        data: {
          events: {
            create: {
              actorUserId: session.userId,
              eventType: 'email_delivery_failed',
              note: `Resend failed for ${doc.sentTo}. Check the address and email settings.`,
            },
          },
        },
      })
      return { error: `Email was not delivered to ${doc.sentTo}. Check the address and email settings, then try Resend again.` }
    }

    await prisma.billingDocument.update({
      where: { id: doc.id },
      data: {
        status: nextStatus as PrismaBillingDocumentStatus,
        sentAt: new Date(),
        events: {
          create: {
            actorUserId: session.userId,
            eventType: 'resent',
            note: `Resent to ${doc.sentTo}`,
          },
        },
      },
    })

    await writeAuditLog({
            actorUserId: session.userId,
      entityType: 'billingDocument',
      entityId: doc.id,
      action: 'billingDocument.resent',
      summary: `Resent billing document to ${doc.sentTo}.`,
      metadata: { requestId, status: nextStatus },
    })

    revalidatePath(`/requests/${requestId}`)
    return { error: null, success: true }
  } catch (error) {
    await logServerActionError('billing.resend', error, { requestId, billingDocumentId })
    return { error: 'Could not resend billing document.' }
  }
}

export async function duplicateBillingDocumentAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const billingDocumentId = String(formData.get('billingDocumentId') ?? '')
  const requestId = String(formData.get('requestId') ?? '')

  try {
    const doc = await getOwnedBillingDocument(session.userId, billingDocumentId, requestId)
    if (!doc) return { error: 'Billing document not found.' }

    const duplicatedStatus = 'draft' as BillingDocumentStatus
    const duplicatedTitle = `${doc.title} copy`
    const pdfHtml = renderBillingPdfHtml({
      title: duplicatedTitle,
      recipientLabel: doc.recipientType === 'tenant'
        ? (doc.request.submittedByName || doc.request.submittedByEmail || 'Tenant')
        : (doc.request.assignedVendorName || 'Vendor'),
      documentType: doc.documentType,
      status: duplicatedStatus,
      amountCents: doc.totalCents,
      paidCents: 0,
      currency: doc.currency,
      description: doc.description ?? '',
      requestTitle: doc.request.title,
      propertyName: doc.request.property.name,
      unitLabel: doc.request.unit.label,
    })

    const duplicated = await prisma.billingDocument.create({
      data: {
        requestId: doc.requestId,
        recipientType: doc.recipientType,
        documentType: doc.documentType,
        status: duplicatedStatus as PrismaBillingDocumentStatus,
        currency: doc.currency,
        totalCents: doc.totalCents,
        paidCents: 0,
        title: duplicatedTitle,
        description: doc.description,
        pdfUrl: `data:text/html;charset=utf-8,${encodeURIComponent(pdfHtml)}`,
        sentTo: null,
        sentAt: null,
        createdByUserId: session.userId,
        events: {
          create: {
            actorUserId: session.userId,
            eventType: 'duplicated',
            note: `Draft copy created from ${doc.id}`,
          },
        },
      },
    })

    await writeAuditLog({
            actorUserId: session.userId,
      entityType: 'billingDocument',
      entityId: duplicated.id,
      action: 'billingDocument.duplicated',
      summary: `Duplicated billing document from ${doc.id}.`,
      metadata: { requestId, sourceBillingDocumentId: doc.id },
    })

    revalidatePath(`/requests/${requestId}`)
    return { error: null, success: true }
  } catch (error) {
    await logServerActionError('billing.duplicate', error, { requestId, billingDocumentId })
    return { error: 'Could not duplicate billing document.' }
  }
}

export async function voidBillingDocumentAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const billingDocumentId = String(formData.get('billingDocumentId') ?? '')
  const requestId = String(formData.get('requestId') ?? '')

  try {
    const doc = await getOwnedBillingDocument(session.userId, billingDocumentId, requestId)
    if (!doc) return { error: 'Billing document not found.' }
    const currentStatus = doc.status as BillingDocumentStatus
    if (currentStatus === 'void') return { error: 'Billing document is already void.' }

    await prisma.billingDocument.update({
      where: { id: doc.id },
      data: {
        status: 'void',
        events: {
          create: {
            actorUserId: session.userId,
            eventType: 'voided',
            note: 'Document voided by operator.',
          },
        },
      },
    })

    await writeAuditLog({
            actorUserId: session.userId,
      entityType: 'billingDocument',
      entityId: doc.id,
      action: 'billingDocument.voided',
      summary: 'Voided billing document.',
      metadata: { requestId },
    })

    await closeCompletedRequestIfFullySettled(requestId, session.userId)
    revalidatePath(`/requests/${requestId}`)
    revalidatePath('/dashboard')
    return { error: null, success: true }
  } catch (error) {
    await logServerActionError('billing.void', error, { requestId, billingDocumentId })
    return { error: 'Could not void billing document.' }
  }
}
