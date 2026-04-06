'use server'

import { revalidatePath } from 'next/cache'
import { BillingDocumentStatus as PrismaBillingDocumentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { renderBillingPdfHtml } from '@/lib/billing-pdf'
import { centsFromDollars, deriveBillingStatus, formatMoney } from '@/lib/billing-utils'
import { buildBillingDocumentMessage, sendNotification } from '@/lib/notify'
import type { BillingDocumentStatus } from '@/lib/billing-types'

export type BillingActionState = { error: string | null; success?: boolean }

function inferDocumentType(recipientType: string) {
  return recipientType === 'vendor' ? 'vendor_remittance' : 'tenant_invoice'
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

async function notifyBillingRecipient({
  to,
  title,
  recipientLabel,
  documentType,
  status,
  totalCents,
  paidCents,
  currency,
}: {
  to: string
  title: string
  recipientLabel: string
  documentType: 'tenant_invoice' | 'vendor_remittance'
  status: BillingDocumentStatus
  totalCents: number
  paidCents: number
  currency: 'usd' | 'peso' | 'pound' | 'euro'
}) {
  await sendNotification(buildBillingDocumentMessage({
    to,
    title,
    recipientLabel,
    documentType,
    status,
    amountLabel: formatMoney(totalCents, currency),
    paidLabel: formatMoney(paidCents, currency),
    balanceLabel: formatMoney(totalCents - paidCents, currency),
  }))
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

    await prisma.billingDocument.create({
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

    if (sentTo) {
      await notifyBillingRecipient({
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
      })
    }

    revalidatePath(`/requests/${requestId}`)
    return { error: null, success: true }
  } catch {
    return { error: 'Could not create billing document.' }
  }
}

export async function updateBillingDocumentAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  const billingDocumentId = String(formData.get('billingDocumentId') ?? '')
  const requestId = String(formData.get('requestId') ?? '')
  const paidRaw = String(formData.get('paidAmount') ?? '').trim()
  const paidCents = centsFromDollars(paidRaw)
  if (paidCents === null) return { error: 'Invalid paid amount.' }

  try {
    const doc = await prisma.billingDocument.findFirst({
      where: {
        id: billingDocumentId,
        requestId,
        request: { property: { ownerId: session.userId } },
      },
    })
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

    revalidatePath(`/requests/${requestId}`)
    return { error: null, success: true }
  } catch {
    return { error: 'Could not update billing document.' }
  }
}

export async function resendBillingDocumentAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

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

    await notifyBillingRecipient({
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
    })

    revalidatePath(`/requests/${requestId}`)
    return { error: null, success: true }
  } catch {
    return { error: 'Could not resend billing document.' }
  }
}

export async function duplicateBillingDocumentAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  const billingDocumentId = String(formData.get('billingDocumentId') ?? '')
  const requestId = String(formData.get('requestId') ?? '')

  try {
    const doc = await getOwnedBillingDocument(session.userId, billingDocumentId, requestId)
    if (!doc) return { error: 'Billing document not found.' }

    const duplicatedStatus = (doc.sentTo
      ? deriveBillingStatus(doc.totalCents, doc.paidCents)
      : 'draft') as BillingDocumentStatus
    const duplicatedTitle = `${doc.title} copy`
    const pdfHtml = renderBillingPdfHtml({
      title: duplicatedTitle,
      recipientLabel: doc.recipientType === 'tenant'
        ? (doc.request.submittedByName || doc.request.submittedByEmail || 'Tenant')
        : (doc.request.assignedVendorName || 'Vendor'),
      documentType: doc.documentType,
      status: duplicatedStatus,
      amountCents: doc.totalCents,
      paidCents: doc.paidCents,
      currency: doc.currency,
      description: doc.description ?? '',
      requestTitle: doc.request.title,
      propertyName: doc.request.property.name,
      unitLabel: doc.request.unit.label,
    })

    await prisma.billingDocument.create({
      data: {
        requestId: doc.requestId,
        recipientType: doc.recipientType,
        documentType: doc.documentType,
        status: duplicatedStatus as PrismaBillingDocumentStatus,
        currency: doc.currency,
        totalCents: doc.totalCents,
        paidCents: doc.paidCents,
        title: duplicatedTitle,
        description: doc.description,
        pdfUrl: `data:text/html;charset=utf-8,${encodeURIComponent(pdfHtml)}`,
        sentTo: doc.sentTo,
        sentAt: doc.sentTo ? new Date() : null,
        createdByUserId: session.userId,
        events: {
          create: {
            actorUserId: session.userId,
            eventType: 'duplicated',
            note: `Duplicated from ${doc.id}`,
          },
        },
      },
    })

    revalidatePath(`/requests/${requestId}`)
    return { error: null, success: true }
  } catch {
    return { error: 'Could not duplicate billing document.' }
  }
}

export async function voidBillingDocumentAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

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

    revalidatePath(`/requests/${requestId}`)
    return { error: null, success: true }
  } catch {
    return { error: 'Could not void billing document.' }
  }
}
