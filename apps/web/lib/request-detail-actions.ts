'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { getLandlordSession } from '@/lib/landlord-session'
import type { CurrencyOption, DispatchStatus, LanguageOption, RequestStatus, ReviewStatus } from '@/lib/types'
import {
  sendNotification,
  buildStatusChangedMessage,
  buildTenantCommentMessage,
  buildTenantQueueViewedMessage,
  buildTenantVendorUpdateMessage,
  buildVendorAssignedMessage,
  buildVendorAwardedMessage,
} from '@/lib/notify'
import { createVendorDispatchLink } from '@/lib/vendor-dispatch-link'
import { applyRequestAutomation } from '@/lib/automation'
import { writeAuditLog } from '@/lib/audit-log'
import { areEmailNotificationsEnabled } from '@/lib/notification-preferences'
import { renderBillingPdfHtml } from '@/lib/billing-pdf'
import { logServerActionError } from '@/lib/observability'

export type RequestActionState = { error: string | null; success?: boolean; message?: string }

export async function updateRequestDetailsAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }
  const requestId = String(formData.get('requestId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim()
  const urgency = String(formData.get('urgency') ?? '').trim()
  if (!title || !description || !category || !urgency) return { error: 'Complete every request detail.' }
  if (title.length > 200 || description.length > 2000) return { error: 'Request details are too long.' }
  if (!['low', 'medium', 'high', 'urgent'].includes(urgency)) return { error: 'Invalid urgency.' }

  const updated = await prisma.maintenanceRequest.updateMany({
    where: { id: requestId, property: { ownerId: session.userId } },
    data: { title, description, category, urgency: urgency as 'low' | 'medium' | 'high' | 'urgent' },
  }).catch(() => ({ count: 0 }))
  if (!updated.count) return { error: 'Request not found or could not be updated.' }
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'request', entityId: requestId, action: 'request.detailsUpdated', summary: `Updated request details for ${title}.`, metadata: { category, urgency } })
  revalidatePath(`/requests/${requestId}`)
  revalidatePath('/dashboard')
  return { error: null, success: true, message: 'Request details saved.' }
}

function parseVendorIds(formData: FormData): string[] {
  return formData
    .getAll('vendorIds')
    .map((value) => String(value).trim())
    .filter(Boolean)
}

async function getAwardedInvite(requestId: string, userId: string) {
  return prisma.tenderInvite.findFirst({
    where: {
      requestId,
      status: 'awarded',
      request: { property: { ownerId: userId } },
    },
    include: { vendor: true, tender: true },
    orderBy: { awardedAt: 'desc' },
  })
}

const VALID_STATUSES: RequestStatus[] = ['requested', 'approved', 'declined', 'vendor_selected', 'scheduled', 'in_progress', 'completed', 'closed', 'canceled', 'reopened']
const VALID_DISPATCH_STATUSES: DispatchStatus[] = ['assigned', 'contacted', 'accepted', 'scheduled', 'in_progress', 'completed', 'declined', 'canceled']
const VALID_QUICK_ACTIONS = ['claim-for-review', 'mark-scheduled', 'start-work', 'needs-follow-up', 'mark-reassignment-needed', 'take-over-claim', 'release-claim'] as const

const ALLOWED_STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  requested: ['approved', 'declined', 'canceled'],
  approved: ['vendor_selected', 'declined', 'canceled', 'scheduled'],
  declined: ['reopened'],
  vendor_selected: ['approved', 'scheduled', 'canceled'],
  scheduled: ['vendor_selected', 'in_progress', 'canceled'],
  in_progress: ['completed', 'vendor_selected'],
  completed: ['closed', 'reopened'],
  closed: ['reopened'],
  canceled: ['reopened'],
  reopened: ['approved', 'vendor_selected', 'scheduled'],
}

function deriveTriageMeta(preferredCurrency: string, preferredLanguage: string) {
  const triageTags: string[] = []

  if (preferredLanguage !== 'english') {
    triageTags.push(`language:${preferredLanguage}`)
  }

  if (preferredCurrency !== 'usd') {
    triageTags.push(`currency:${preferredCurrency}`)
  }

  return { triageTags, slaBucket: 'standard' }
}

function toClosedTerminal(status: RequestStatus) {
  return ['closed', 'declined', 'canceled'].includes(status)
}

function tenantRequestActionUrl(requestId: string, section?: string) {
  return `${getAppBaseUrl('tenant notification links')}/mobile/requests/${requestId}${section ? `#${section}` : ''}`
}

function vendorRespondActionUrl(token: string) {
  return `${getAppBaseUrl('vendor notification links')}/vendor/respond/${token}`
}

export async function updateStatusFormAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const requestId = String(formData.get('requestId') ?? '')
  const fromStatus = formData.get('fromStatus') as RequestStatus
  const toStatus = formData.get('toStatus') as RequestStatus
  const reason = String(formData.get('reason') ?? '').trim()

  if (!VALID_STATUSES.includes(toStatus)) return { error: 'Invalid status.' }
  if (toStatus === fromStatus) return { error: 'Request is already in that status.' }
  if (!ALLOWED_STATUS_TRANSITIONS[fromStatus]?.includes(toStatus)) return { error: `Cannot move request from ${fromStatus} to ${toStatus}.` }
  if (['declined', 'canceled', 'reopened'].includes(toStatus) && !reason) return { error: 'A reason is required for this status change.' }

  let tenantEmail: string | undefined
  let tenantName: string | undefined
  let title: string | undefined
  let propertyName: string | undefined
  let unitLabel: string | undefined

  try {
    const ownedRequest = await prisma.maintenanceRequest.findFirst({
      where: { id: requestId, property: { ownerId: session.userId } },
      select: { id: true },
    })
    if (!ownedRequest) return { error: 'Request not found.' }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          status: toStatus,
          declineReason: toStatus === 'declined' ? reason : null,
          cancelReason: toStatus === 'canceled' ? reason : null,
          reopenedReason: toStatus === 'reopened' ? reason : null,
          closedAt: toStatus === 'closed' ? new Date() : toClosedTerminal(toStatus) ? null : undefined,
          actualCompletedAt: toStatus === 'completed' ? new Date() : undefined,
          reviewState: toStatus === 'completed' ? 'vendor_completed_pending_review' : toStatus === 'closed' ? 'approved' : toStatus === 'reopened' ? 'reopened_after_review' : undefined,
          reviewNote: reason || undefined,
        },
        include: { property: true, unit: true },
      })
      await tx.statusEvent.create({
        data: { requestId, fromStatus, toStatus, actorUserId: session.userId },
      })

      tenantEmail = updated.submittedByEmail ?? undefined
      tenantName = updated.submittedByName ?? undefined
      title = updated.title
      propertyName = updated.property.name
      unitLabel = updated.unit.label
    })
  } catch (error) {
    await logServerActionError('request.status.update', error, { requestId, fromStatus, toStatus })
    return { error: 'Could not update status. Database may not be connected.' }
  }

  await writeAuditLog({
    orgId: session.userId,
    actorUserId: session.userId,
    entityType: 'request',
    entityId: requestId,
    action: 'request.statusChanged',
    summary: `Changed request status from ${fromStatus} to ${toStatus}.`,
    metadata: { fromStatus, toStatus, reason: reason || null },
  })

  revalidatePath(`/requests/${requestId}`)
  revalidatePath('/dashboard')

  if (tenantEmail && tenantName && title && propertyName && unitLabel && await areEmailNotificationsEnabled(session.userId)) {
    await sendNotification(
      buildStatusChangedMessage({
        requestId,
        title,
        propertyName,
        unitLabel,
        tenantEmail,
        tenantName,
        fromStatus,
        toStatus,
        actionUrl: tenantRequestActionUrl(requestId),
      }),
      { ownerUserId: session.userId, requestId },
    )
  }

  return { error: null, success: true }
}

export async function updateVendorFormAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const requestId = formData.get('requestId') as string
  const selectedVendorIds = parseVendorIds(formData)
  const singleVendorId = ((formData.get('vendorId') as string) ?? '').trim()
  const mode = String(formData.get('mode') ?? 'assign').trim()
  let vendorName = ((formData.get('vendorName') as string) ?? '').trim()
  let vendorEmail = ((formData.get('vendorEmail') as string) ?? '').trim().toLowerCase()
  let vendorPhone = ((formData.get('vendorPhone') as string) ?? '').trim()

  if (vendorName.length > 120) return { error: 'Vendor name must be 120 characters or fewer.' }
  if (vendorEmail.length > 254) return { error: 'Vendor email must be 254 characters or fewer.' }
  if (vendorPhone.length > 40) return { error: 'Vendor phone must be 40 characters or fewer.' }
  if (vendorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendorEmail)) return { error: 'Vendor email is invalid.' }

  const tenderVendorIds = Array.from(new Set([singleVendorId, ...selectedVendorIds].filter(Boolean)))
  const shouldTender = mode === 'tender'

  if (shouldTender && tenderVendorIds.length === 0) return { error: 'Select at least one vendor to ask for a bid.' }

  if (shouldTender) {
    try {
      const request = await prisma.maintenanceRequest.findFirst({
        where: { id: requestId, property: { ownerId: session.userId } },
        include: { property: true, unit: true },
      })
      if (!request) return { error: 'Request not found.' }

      const vendors = await prisma.vendor.findMany({
        where: { id: { in: tenderVendorIds }, orgId: session.userId, isActive: true },
        orderBy: { name: 'asc' },
      })
      if (vendors.length !== tenderVendorIds.length) return { error: 'One or more selected vendors were not found.' }

      const appUrl = getAppBaseUrl('vendor tender notifications')
      const tender = await prisma.requestTender.create({
        data: {
          requestId,
          status: 'open',
          title: `Bid round ${new Date().toLocaleDateString('en-US')}`,
          note: 'Manager opened a multi-vendor bid round.',
          sentAt: new Date(),
          invites: {
            create: vendors.map((vendor) => ({ requestId, vendorId: vendor.id, status: 'invited' })),
          },
        },
        include: { invites: true },
      })

      for (const vendor of vendors) {
        await prisma.vendorDispatchEvent.create({
          data: {
            requestId,
            vendorId: vendor.id,
            actorUserId: session.userId,
            status: 'assigned',
            note: 'Vendor invited to bid on this request.',
          },
        })

        if (vendor.email) {
          const invite = tender.invites.find((entry) => entry.vendorId === vendor.id)
          const dispatchLink = invite ? await createVendorDispatchLink(requestId, vendor.id, invite.id).catch(() => null) : null
          if (await areEmailNotificationsEnabled(session.userId)) await sendNotification(buildVendorAssignedMessage({
            requestId,
            title: request.title,
            propertyName: request.property.name,
            unitLabel: request.unit.label,
            vendorName: vendor.name,
            vendorEmail: vendor.email,
            tenantName: request.submittedByName ?? undefined,
            tenantEmail: request.submittedByEmail ?? undefined,
            urgency: request.urgency,
            category: request.category,
            preferredCurrency: request.preferredCurrency,
            preferredLanguage: request.preferredLanguage,
            responseLink: dispatchLink ? `${appUrl}/vendor/respond/${dispatchLink.rawToken}` : undefined,
          }), { ownerUserId: session.userId, requestId })
        }
      }

      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          assignedVendorId: null,
          assignedVendorName: vendors.map((vendor) => vendor.name).join(', ') || null,
          assignedVendorEmail: null,
          assignedVendorPhone: null,
          dispatchStatus: 'assigned',
          reviewState: 'none',
          reviewNote: null,
          status: 'approved',
        },
      })

      await writeAuditLog({
        orgId: session.userId,
        actorUserId: session.userId,
        entityType: 'request',
        entityId: requestId,
        action: 'request.tenderSent',
        summary: `Sent request to ${vendors.length} vendor${vendors.length === 1 ? '' : 's'} for bids.`,
        metadata: { vendorIds: vendors.map((vendor) => vendor.id), vendorNames: vendors.map((vendor) => vendor.name) },
      })

      await applyRequestAutomation(requestId)
      revalidatePath(`/requests/${requestId}`)
      revalidatePath('/dashboard')
      return { error: null, success: true, message: `Bid request sent to ${vendors.length} vendor${vendors.length === 1 ? '' : 's'}.` }
    } catch (error) {
      await logServerActionError('request.tender.send', error, { requestId, vendorIds: tenderVendorIds })
      return { error: 'Could not send bid invitations.' }
    }
  }

  const vendorId = singleVendorId

  if (vendorId) {
    const selectedVendor = await prisma.vendor.findFirst({
      where: { id: vendorId, orgId: session.userId, isActive: true },
    }).catch(() => null)

    if (!selectedVendor) return { error: 'Recommended vendor not found.' }

    vendorName = selectedVendor.name
    vendorEmail = selectedVendor.email ?? ''
    vendorPhone = selectedVendor.phone ?? ''
  }

  let notificationPayload: {
    requestId: string
    title: string
    propertyName: string
    unitLabel: string
    vendorName: string
    vendorEmail: string
    tenantName?: string
    tenantEmail?: string
    urgency: string
    category: string
    preferredCurrency?: string
    preferredLanguage?: string
    responseLink?: string
  } | undefined

  try {
    const ownedRequest = await prisma.maintenanceRequest.findFirst({
      where: { id: requestId, property: { ownerId: session.userId } },
      select: { id: true },
    })
    if (!ownedRequest) return { error: 'Request not found.' }

    const updated = await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        assignedVendorId: vendorId || null,
        assignedVendorName: vendorName || null,
        assignedVendorEmail: vendorEmail || null,
        assignedVendorPhone: vendorPhone || null,
        dispatchStatus: vendorName ? 'assigned' : null,
        status: vendorName ? 'vendor_selected' : 'approved',
      },
      include: { property: true, unit: true },
    })

    if (vendorName) {
      await prisma.vendorDispatchEvent.create({
        data: {
          requestId,
          vendorId: vendorId || null,
          actorUserId: session.userId,
          status: 'assigned',
          note: 'Vendor assigned from landlord workflow.',
        },
      }).catch(() => null)
    }

    if (vendorName && vendorEmail) {
      const dispatchLink = vendorId ? await createVendorDispatchLink(requestId, vendorId).catch(() => null) : null
      const appUrl = getAppBaseUrl('vendor dispatch notifications')
      notificationPayload = {
        requestId,
        title: updated.title,
        propertyName: updated.property.name,
        unitLabel: updated.unit.label,
        vendorName,
        vendorEmail,
        tenantName: updated.submittedByName ?? undefined,
        tenantEmail: updated.submittedByEmail ?? undefined,
        urgency: updated.urgency,
        category: updated.category,
        preferredCurrency: updated.preferredCurrency,
        preferredLanguage: updated.preferredLanguage,
        responseLink: dispatchLink ? `${appUrl}/vendor/respond/${dispatchLink.rawToken}` : undefined,
      }
    }

    await writeAuditLog({
      orgId: session.userId,
      actorUserId: session.userId,
      entityType: 'request',
      entityId: requestId,
      action: 'request.vendorUpdated',
      summary: vendorName ? `Assigned vendor ${vendorName}.` : 'Cleared assigned vendor.',
      metadata: { vendorId: vendorId || null, vendorName: vendorName || null, vendorEmail: vendorEmail || null, vendorPhone: vendorPhone || null },
    })

    await applyRequestAutomation(requestId)
    revalidatePath(`/requests/${requestId}`)
  } catch (error) {
    await logServerActionError('request.vendor.update', error, { requestId, vendorId, mode })
    return { error: 'Could not update vendor. Database may not be connected.' }
  }

  if (notificationPayload) {
    if (await areEmailNotificationsEnabled(session.userId)) {
      await sendNotification(buildVendorAssignedMessage(notificationPayload), { ownerUserId: session.userId, requestId })
    }
  }

  return { error: null, success: true }
}

export async function updatePreferencesFormAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const requestId = formData.get('requestId') as string
  const preferredCurrency = ((formData.get('preferredCurrency') as string) ?? '').trim() as CurrencyOption
  const preferredLanguage = ((formData.get('preferredLanguage') as string) ?? '').trim() as LanguageOption

  if (!['usd'].includes(preferredCurrency)) return { error: 'Invalid currency.' }
  if (!['english', 'spanish', 'french'].includes(preferredLanguage)) return { error: 'Invalid language.' }

  const { triageTags, slaBucket } = deriveTriageMeta(preferredCurrency, preferredLanguage)
  const triageTagsCsv = triageTags.join(',')

  try {
    const ownedRequest = await prisma.maintenanceRequest.findFirst({
      where: { id: requestId, property: { ownerId: session.userId } },
      select: { id: true },
    })
    if (!ownedRequest) return { error: 'Request not found.' }

    await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        preferredCurrency,
        preferredLanguage,
        triageTagsCsv,
        slaBucket,
      },
    })

    await writeAuditLog({
      orgId: session.userId,
      actorUserId: session.userId,
      entityType: 'request',
      entityId: requestId,
      action: 'request.preferencesUpdated',
      summary: `Updated request preferences to ${preferredCurrency} and ${preferredLanguage}.`,
      metadata: { preferredCurrency, preferredLanguage, triageTags, slaBucket },
    })

    await applyRequestAutomation(requestId)
    revalidatePath(`/requests/${requestId}`)
    revalidatePath('/dashboard')
    return { error: null, success: true }
  } catch (error) {
    await logServerActionError('request.preferences.update', error, { requestId, preferredCurrency, preferredLanguage })
    return { error: 'Could not update preferences. Database may not be connected.' }
  }
}

export async function awardTenderInviteAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const requestId = String(formData.get('requestId') ?? '')
  const tenderId = String(formData.get('tenderId') ?? '')
  const inviteId = String(formData.get('inviteId') ?? '')

  try {
    const invite = await prisma.tenderInvite.findFirst({
      where: {
        id: inviteId,
        tenderId,
        requestId,
        request: { property: { ownerId: session.userId } },
      },
      include: { vendor: true, request: { include: { property: true, unit: true } } },
    })
    if (!invite) return { error: 'Bid invite not found.' }

    await prisma.$transaction(async (tx) => {
      await tx.tenderInvite.updateMany({
        where: { tenderId, id: { not: inviteId }, status: { in: ['invited', 'viewed', 'bid_submitted', 'declined', 'withdrawn'] } },
        data: { status: 'not_awarded' },
      })

      await tx.vendorCommercialItem.updateMany({
        where: {
          requestId,
          itemType: 'bid',
          status: 'submitted',
          vendorId: { not: invite.vendorId },
        },
        data: { status: 'declined' },
      })

      await tx.tenderInvite.update({
        where: { id: inviteId },
        data: { status: 'awarded', awardedAt: new Date() },
      })

      await tx.requestTender.update({
        where: { id: tenderId },
        data: { status: 'awarded', awardedAt: new Date(), closedAt: new Date() },
      })

      const awardedStatus: RequestStatus = invite.proposedStart ? 'scheduled' : 'vendor_selected'

      await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          assignedVendorId: invite.vendorId,
          assignedVendorName: invite.vendor.name,
          assignedVendorEmail: invite.vendor.email ?? null,
          assignedVendorPhone: invite.vendor.phone ?? null,
          dispatchStatus: 'accepted',
          vendorScheduledStart: invite.proposedStart,
          vendorScheduledEnd: invite.proposedEnd,
          reviewState: 'none',
          reviewNote: null,
          status: awardedStatus,
        },
      })

      await tx.statusEvent.create({
        data: { requestId, toStatus: awardedStatus, actorUserId: session.userId },
      })

      await tx.vendorDispatchEvent.create({
        data: {
          requestId,
          vendorId: invite.vendorId,
          actorUserId: session.userId,
          status: 'accepted',
          note: 'Vendor bid approved from bid request workflow.',
          scheduledStart: invite.proposedStart,
          scheduledEnd: invite.proposedEnd,
        },
      })
    })

    await writeAuditLog({
      orgId: session.userId,
      actorUserId: session.userId,
      entityType: 'request',
      entityId: requestId,
      action: 'request.tenderAwarded',
      summary: `Approved bid from vendor ${invite.vendor.name}.`,
      metadata: { tenderId, inviteId, vendorId: invite.vendorId },
    })

    await applyRequestAutomation(requestId)
    revalidatePath(`/requests/${requestId}`)
    revalidatePath('/dashboard')

    if (invite.vendor.email && await areEmailNotificationsEnabled(session.userId)) {
      const dispatchLink = await createVendorDispatchLink(requestId, invite.vendorId, inviteId).catch(() => null)
      await sendNotification(buildVendorAwardedMessage({
        requestId,
        title: invite.request.title,
        propertyName: invite.request.property.name,
        unitLabel: invite.request.unit.label,
        vendorName: invite.vendor.name,
        vendorEmail: invite.vendor.email,
        tenantName: invite.request.submittedByName ?? undefined,
        tenantEmail: invite.request.submittedByEmail ?? undefined,
        urgency: invite.request.urgency,
        category: invite.request.category,
        preferredCurrency: invite.request.preferredCurrency,
        preferredLanguage: invite.request.preferredLanguage,
        bidAmountLabel: invite.bidAmountCents != null ? `USD ${(invite.bidAmountCents / 100).toFixed(2)}` : undefined,
        responseLink: dispatchLink ? vendorRespondActionUrl(dispatchLink.rawToken) : undefined,
      }), { ownerUserId: session.userId, requestId })
    }

    if (
      invite.request.submittedByEmail &&
      invite.request.submittedByName &&
      await areEmailNotificationsEnabled(session.userId)
    ) {
      if (invite.proposedStart) {
        await sendNotification(buildTenantVendorUpdateMessage({
          requestId,
          title: invite.request.title,
          propertyName: invite.request.property.name,
          unitLabel: invite.request.unit.label,
          tenantEmail: invite.request.submittedByEmail,
          tenantName: invite.request.submittedByName,
          vendorName: invite.vendor.name,
          dispatchStatus: 'scheduled',
          scheduledStart: invite.proposedStart.toISOString(),
          scheduledEnd: invite.proposedEnd?.toISOString(),
          actionUrl: tenantRequestActionUrl(requestId),
        }), { ownerUserId: session.userId, requestId })
      } else {
        await sendNotification(buildStatusChangedMessage({
          requestId,
          title: invite.request.title,
          propertyName: invite.request.property.name,
          unitLabel: invite.request.unit.label,
          tenantEmail: invite.request.submittedByEmail,
          tenantName: invite.request.submittedByName,
          fromStatus: invite.request.status,
          toStatus: 'vendor_selected',
          actionUrl: tenantRequestActionUrl(requestId),
        }), { ownerUserId: session.userId, requestId })
      }
    }

    return { error: null, success: true, message: 'Bid approved.' }
  } catch (error) {
    await logServerActionError('request.tender.award', error, { requestId, tenderId, inviteId })
    return { error: 'Could not approve bid invite.' }
  }
}

export async function approveVendorCommercialItemAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const requestId = String(formData.get('requestId') ?? '')
  const itemId = String(formData.get('itemId') ?? '')

  try {
    const item = await prisma.vendorCommercialItem.findFirst({
      where: {
        id: itemId,
        requestId,
        request: { property: { ownerId: session.userId } },
      },
      include: {
        vendor: true,
        request: { include: { property: true, unit: true } },
      },
    })

    if (!item) return { error: 'Vendor submission not found.' }
    if (item.status !== 'submitted') return { error: 'Vendor submission is already resolved.' }

    await prisma.$transaction(async (tx) => {
      await tx.vendorCommercialItem.update({
        where: { id: itemId },
        data: { status: 'approved' },
      })

      if (item.itemType === 'bid') {
        const nextStatus: RequestStatus =
          item.request.status === 'requested' || item.request.status === 'approved' || item.request.status === 'reopened'
            ? 'vendor_selected'
            : item.request.status

        await tx.maintenanceRequest.update({
          where: { id: requestId },
          data: {
            assignedVendorId: item.vendorId,
            assignedVendorName: item.vendor.name,
            assignedVendorEmail: item.vendor.email ?? null,
            assignedVendorPhone: item.vendor.phone ?? null,
            dispatchStatus: 'accepted',
            reviewState: 'none',
            reviewNote: null,
            status: nextStatus,
          },
        })

        if (nextStatus !== item.request.status) {
          await tx.statusEvent.create({
            data: { requestId, toStatus: nextStatus, actorUserId: session.userId },
          })
        }

        await tx.vendorDispatchEvent.create({
          data: {
            requestId,
            vendorId: item.vendorId,
            actorUserId: session.userId,
            status: 'accepted',
            note: 'Vendor bid approved from vendor submissions.',
          },
        })
      }

      await upsertVendorRemittanceDraft(tx, {
        requestId,
        vendorId: item.vendorId,
        vendorName: item.vendor.name,
        vendorEmail: item.vendor.email,
        userId: session.userId,
        approvedItemId: item.id,
      })
    })

    await writeAuditLog({
      orgId: session.userId,
      actorUserId: session.userId,
      entityType: 'vendorCommercialItem',
      entityId: itemId,
      action: 'vendorCommercialItem.approved',
      summary: `Approved vendor ${item.itemType} submission from ${item.vendor.name}.`,
      metadata: { requestId, vendorId: item.vendorId, itemType: item.itemType, amountCents: item.amountCents },
    })

    await applyRequestAutomation(requestId)
    revalidatePath(`/requests/${requestId}`)
    revalidatePath('/dashboard')
    if (item.itemType === 'bid' && item.vendor.email && await areEmailNotificationsEnabled(session.userId)) {
      const dispatchLink = await createVendorDispatchLink(requestId, item.vendorId).catch(() => null)
      await sendNotification(buildVendorAwardedMessage({
        requestId,
        title: item.request.title,
        propertyName: item.request.property.name,
        unitLabel: item.request.unit.label,
        vendorName: item.vendor.name,
        vendorEmail: item.vendor.email,
        tenantName: item.request.submittedByName ?? undefined,
        tenantEmail: item.request.submittedByEmail ?? undefined,
        urgency: item.request.urgency,
        category: item.request.category,
        preferredCurrency: item.request.preferredCurrency,
        preferredLanguage: item.request.preferredLanguage,
        bidAmountLabel: `USD ${(item.amountCents / 100).toFixed(2)}`,
        responseLink: dispatchLink ? vendorRespondActionUrl(dispatchLink.rawToken) : undefined,
      }), { ownerUserId: session.userId, requestId })
    }
    return { error: null, success: true, message: item.itemType === 'bid' ? 'Bid approved, vendor assigned, and payment draft posted.' : 'Vendor submission approved and payment draft posted.' }
  } catch (error) {
    await logServerActionError('vendorCommercialItem.approve', error, { requestId, itemId })
    return { error: 'Could not approve vendor submission.' }
  }
}

export async function updateDispatchFormAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const requestId = formData.get('requestId') as string
  const dispatchStatus = ((formData.get('dispatchStatus') as string) ?? '').trim() as DispatchStatus
  const note = ((formData.get('note') as string) ?? '').trim()
  const scheduledStartRaw = ((formData.get('scheduledStart') as string) ?? '').trim()
  const scheduledEndRaw = ((formData.get('scheduledEnd') as string) ?? '').trim()
  let tenantNotification:
    | {
        tenantEmail: string
        tenantName: string
        title: string
        propertyName: string
        unitLabel: string
        vendorName: string
        fromStatus: RequestStatus
        toStatus?: RequestStatus
      }
    | undefined

  if (!VALID_DISPATCH_STATUSES.includes(dispatchStatus)) return { error: 'Invalid work status.' }

  const scheduledStart = scheduledStartRaw ? new Date(scheduledStartRaw) : null
  const scheduledEnd = scheduledEndRaw ? new Date(scheduledEndRaw) : null

  if (scheduledStart && Number.isNaN(scheduledStart.getTime())) return { error: 'Enter a valid scheduled start time.' }
  if (scheduledEnd && Number.isNaN(scheduledEnd.getTime())) return { error: 'Enter a valid scheduled end time.' }
  if (scheduledStart && scheduledEnd && scheduledEnd < scheduledStart) return { error: 'Scheduled end must be after start.' }

  try {
    const request = await prisma.maintenanceRequest.findFirst({
      where: { id: requestId, property: { ownerId: session.userId } },
      include: { property: true, unit: true },
    })

    if (!request) return { error: 'Request not found.' }

    const awardedInvite = await getAwardedInvite(requestId, session.userId)
    const vendorId = awardedInvite?.vendorId ?? request.assignedVendorId ?? null
    const requestStatus: RequestStatus | undefined = dispatchStatus === 'scheduled'
      ? 'scheduled'
      : dispatchStatus === 'in_progress'
        ? 'in_progress'
        : dispatchStatus === 'completed'
          ? 'completed'
          : dispatchStatus === 'declined' || dispatchStatus === 'canceled'
            ? 'approved'
            : undefined
    const reviewState: ReviewStatus | undefined = dispatchStatus === 'completed'
      ? 'vendor_completed_pending_review'
      : dispatchStatus === 'declined' || dispatchStatus === 'canceled'
        ? 'vendor_declined_reassignment_needed'
        : undefined

    await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        assignedVendorId: awardedInvite?.vendorId ?? request.assignedVendorId ?? null,
        assignedVendorName: awardedInvite?.vendor.name ?? undefined,
        assignedVendorEmail: awardedInvite?.vendor.email ?? null,
        assignedVendorPhone: awardedInvite?.vendor.phone ?? null,
        dispatchStatus,
        vendorScheduledStart: scheduledStart,
        vendorScheduledEnd: scheduledEnd,
        status: requestStatus,
        reviewState,
        reviewNote: dispatchStatus === 'declined' || dispatchStatus === 'canceled'
          ? 'Vendor could not continue with this assignment. Reassignment needed.'
          : undefined,
        actualCompletedAt: dispatchStatus === 'completed' ? new Date() : undefined,
      },
    })

    if (request.submittedByEmail && request.submittedByName) {
      tenantNotification = {
        tenantEmail: request.submittedByEmail,
        tenantName: request.submittedByName,
        title: request.title,
        propertyName: request.property.name,
        unitLabel: request.unit.label,
        vendorName: awardedInvite?.vendor.name ?? request.assignedVendorName ?? 'Vendor',
        fromStatus: request.status,
        toStatus: requestStatus,
      }
    }

    if (requestStatus) {
      await prisma.statusEvent.create({
        data: { requestId, toStatus: requestStatus, actorUserId: session.userId },
      })
    }

    await prisma.vendorDispatchEvent.create({
      data: {
        requestId,
        vendorId,
        actorUserId: session.userId,
        status: dispatchStatus,
        note: note || null,
        scheduledStart,
        scheduledEnd,
      },
    })

    await writeAuditLog({
      orgId: session.userId,
      actorUserId: session.userId,
      entityType: 'request',
      entityId: requestId,
      action: 'request.dispatchUpdated',
      summary: `Updated work status to ${dispatchStatus}.`,
      metadata: { dispatchStatus, note, scheduledStart: scheduledStart?.toISOString() ?? null, scheduledEnd: scheduledEnd?.toISOString() ?? null },
    })

    await applyRequestAutomation(requestId)
    revalidatePath(`/requests/${requestId}`)
    revalidatePath('/dashboard')
    if (tenantNotification && await areEmailNotificationsEnabled(session.userId)) {
      if (dispatchStatus === 'scheduled' || scheduledStart || scheduledEnd || dispatchStatus === 'completed') {
        await sendNotification(buildTenantVendorUpdateMessage({
          requestId,
          title: tenantNotification.title,
          propertyName: tenantNotification.propertyName,
          unitLabel: tenantNotification.unitLabel,
          tenantEmail: tenantNotification.tenantEmail,
          tenantName: tenantNotification.tenantName,
          vendorName: tenantNotification.vendorName,
          dispatchStatus,
          note: note || undefined,
          scheduledStart: scheduledStart?.toISOString(),
          scheduledEnd: scheduledEnd?.toISOString(),
          actionUrl: tenantRequestActionUrl(requestId),
        }), { ownerUserId: session.userId, requestId })
      } else if (tenantNotification.toStatus && tenantNotification.toStatus !== tenantNotification.fromStatus) {
        await sendNotification(buildStatusChangedMessage({
          requestId,
          title: tenantNotification.title,
          propertyName: tenantNotification.propertyName,
          unitLabel: tenantNotification.unitLabel,
          tenantEmail: tenantNotification.tenantEmail,
          tenantName: tenantNotification.tenantName,
          fromStatus: tenantNotification.fromStatus,
          toStatus: tenantNotification.toStatus,
          actionUrl: tenantRequestActionUrl(requestId),
        }), { ownerUserId: session.userId, requestId })
      }
    }
    return { error: null, success: true }
  } catch (error) {
    await logServerActionError('request.dispatch.update', error, { requestId, dispatchStatus })
    return { error: 'Could not update work status.' }
  }
}

export async function reviewVendorUpdateFormAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const requestId = String(formData.get('requestId') ?? '')
  const action = String(formData.get('reviewAction') ?? '').trim()
  const note = String(formData.get('reviewNote') ?? '').trim()

  if (!['approve-completion', 'reopen-request', 'needs-follow-up', 'mark-reassignment-needed'].includes(action)) {
    return { error: 'Invalid review action.' }
  }
  if (['reopen-request'].includes(action) && !note) return { error: 'A reopen reason is required.' }

  try {
    const request = await prisma.maintenanceRequest.findFirst({
      where: { id: requestId, property: { ownerId: session.userId } },
      select: { id: true, status: true },
    })
    if (!request) return { error: 'Request not found.' }

    if (action === 'approve-completion') {
      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          status: 'closed',
          closedAt: new Date(),
          reviewState: 'approved',
          reviewNote: note || 'Landlord approved vendor completion.',
        },
      })

      await prisma.statusEvent.create({
        data: {
          requestId,
          fromStatus: request.status,
          toStatus: 'closed',
          actorUserId: session.userId,
        },
      })
    } else if (action === 'reopen-request') {
      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          status: 'reopened',
          closedAt: null,
          reviewState: 'reopened_after_review',
          reviewNote: note,
          reopenedReason: note,
        },
      })

      await prisma.statusEvent.create({
        data: {
          requestId,
          fromStatus: request.status,
          toStatus: 'reopened',
          actorUserId: session.userId,
        },
      })
    } else if (action === 'needs-follow-up') {
      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          reviewState: 'needs_follow_up',
          reviewNote: note || 'Landlord requested follow-up on vendor update.',
        },
      })
    } else if (action === 'mark-reassignment-needed') {
      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          assignedVendorId: null,
          assignedVendorName: null,
          assignedVendorEmail: null,
          assignedVendorPhone: null,
          dispatchStatus: 'canceled',
          status: 'approved',
          reviewState: 'reassignment_needed',
          reviewNote: note || 'Vendor declined or was removed; reassignment required.',
        },
      })
    }

    await writeAuditLog({
      orgId: session.userId,
      actorUserId: session.userId,
      entityType: 'request',
      entityId: requestId,
      action: 'request.reviewAction',
      summary: `Applied review action ${action}.`,
      metadata: { action, note: note || null },
    })

    await applyRequestAutomation(requestId)
    revalidatePath(`/requests/${requestId}`)
    revalidatePath('/dashboard')
    return { error: null, success: true }
  } catch (error) {
    await logServerActionError('request.review.update', error, { requestId, reviewAction: action })
    return { error: 'Could not apply review action.' }
  }
}

export async function quickRequestAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const requestId = String(formData.get('requestId') ?? '')
  const quickAction = String(formData.get('quickAction') ?? '').trim() as (typeof VALID_QUICK_ACTIONS)[number]

  if (!VALID_QUICK_ACTIONS.includes(quickAction)) return { error: 'Invalid quick action.' }

  try {
    const request = await prisma.maintenanceRequest.findFirst({
      where: { id: requestId, property: { ownerId: session.userId } },
      select: {
        id: true,
        status: true,
        assignedVendorId: true,
        assignedVendorName: true,
        submittedByName: true,
        submittedByEmail: true,
        title: true,
        firstReviewedAt: true,
        claimedAt: true,
        claimedByUserId: true,
        property: { select: { name: true } },
        unit: { select: { label: true } },
      },
    })
    if (!request) return { error: 'Request not found.' }

    let message = 'Quick action applied.'

    if (quickAction === 'claim-for-review') {
      const now = new Date()
      const alreadyClaimedRecently = request.claimedAt && now.getTime() - request.claimedAt.getTime() < 1000 * 60 * 60 * 12
      const shouldNotifyTenant = !alreadyClaimedRecently && !!request.submittedByEmail && !!request.submittedByName

      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          claimedAt: now,
          claimedByUserId: session.userId,
          firstReviewedAt: request.firstReviewedAt ?? now,
        },
      })

      if (shouldNotifyTenant && await areEmailNotificationsEnabled(session.userId)) {
        await sendNotification(buildTenantQueueViewedMessage({
          requestId,
          title: request.title,
          propertyName: request.property.name,
          unitLabel: request.unit.label,
          tenantEmail: request.submittedByEmail!,
          tenantName: request.submittedByName!,
          actionUrl: tenantRequestActionUrl(requestId),
        }), { ownerUserId: session.userId, requestId })
      }

      await writeAuditLog({
        orgId: session.userId,
        actorUserId: session.userId,
        entityType: 'request',
        entityId: requestId,
        action: 'request.queueClaimed',
        summary: 'Operator claimed request from queue for review.',
        metadata: {
          notifiedTenant: shouldNotifyTenant,
          claimedAt: now.toISOString(),
          firstReviewedAt: (request.firstReviewedAt ?? now).toISOString(),
        },
      })

      message = 'Request claimed for review.'
    }

    if (quickAction === 'mark-scheduled') {
      if (!['approved', 'vendor_selected', 'reopened'].includes(request.status)) return { error: 'Only approved, selected, or reopened requests can be marked scheduled from the queue.' }
      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: { status: 'scheduled' },
      })
      await prisma.statusEvent.create({
        data: { requestId, fromStatus: request.status, toStatus: 'scheduled', actorUserId: session.userId },
      })
      message = 'Request marked scheduled.'
    }

    if (quickAction === 'start-work') {
      if (!['vendor_selected', 'scheduled'].includes(request.status)) return { error: 'Only selected or scheduled requests can be started from the queue.' }
      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: { status: 'in_progress', dispatchStatus: 'in_progress' },
      })
      await prisma.statusEvent.create({
        data: { requestId, fromStatus: request.status, toStatus: 'in_progress', actorUserId: session.userId },
      })
      message = 'Request moved to in progress.'
    }

    if (quickAction === 'needs-follow-up') {
      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          reviewState: 'needs_follow_up',
          reviewNote: 'Operator flagged this request for follow-up from queue view.',
        },
      })
      message = 'Request flagged for follow-up.'
    }

    if (quickAction === 'mark-reassignment-needed') {
      if (!request.assignedVendorName && !request.assignedVendorId) return { error: 'No assigned vendor to clear.' }
      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          assignedVendorId: null,
          assignedVendorName: null,
          assignedVendorEmail: null,
          assignedVendorPhone: null,
          dispatchStatus: 'canceled',
          status: 'approved',
          reviewState: 'reassignment_needed',
          reviewNote: 'Operator marked reassignment needed from queue view.',
        },
      })
      message = 'Vendor cleared and reassignment needed flagged.'
    }

    if (quickAction === 'take-over-claim') {
      if (!request.claimedAt || !request.claimedByUserId) return { error: 'This request is not currently claimed.' }
      if (request.claimedByUserId === session.userId) return { error: 'You already own this claim.' }
      if (Date.now() - request.claimedAt.getTime() < 1000 * 60 * 60 * 24) return { error: 'Only stale claims can be taken over.' }

      const now = new Date()
      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          claimedAt: now,
          claimedByUserId: session.userId,
          firstReviewedAt: request.firstReviewedAt ?? now,
        },
      })

      await writeAuditLog({
        orgId: session.userId,
        actorUserId: session.userId,
        entityType: 'request',
        entityId: requestId,
        action: 'request.queueClaimTakenOver',
        summary: 'Operator took over stale queue claim ownership.',
        metadata: {
          previousClaimedByUserId: request.claimedByUserId,
          previousClaimedAt: request.claimedAt.toISOString(),
          claimedAt: now.toISOString(),
        },
      })

      message = 'Stale queue claim taken over.'
    }

    if (quickAction === 'release-claim') {
      if (!request.claimedAt || !request.claimedByUserId) return { error: 'This request is not currently claimed.' }

      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          claimedAt: null,
          claimedByUserId: null,
        },
      })

      await writeAuditLog({
        orgId: session.userId,
        actorUserId: session.userId,
        entityType: 'request',
        entityId: requestId,
        action: 'request.queueClaimReleased',
        summary: 'Operator released queue claim ownership.',
        metadata: {
          previousClaimedByUserId: request.claimedByUserId,
          previousClaimedAt: request.claimedAt.toISOString(),
        },
      })

      message = 'Queue claim released.'
    }

    await writeAuditLog({
      orgId: session.userId,
      actorUserId: session.userId,
      entityType: 'request',
      entityId: requestId,
      action: 'request.quickAction',
      summary: `Applied quick action ${quickAction}.`,
      metadata: { quickAction, message },
    })

    await applyRequestAutomation(requestId)
    revalidatePath(`/requests/${requestId}`)
    revalidatePath('/dashboard')
    revalidatePath('/exceptions')
    return { error: null, success: true, message }
  } catch (error) {
    await logServerActionError('request.quickAction', error, { requestId, quickAction })
    return { error: 'Could not apply quick action.' }
  }
}

export async function addCommentFormAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const requestId = formData.get('requestId') as string
  const body = ((formData.get('body') as string) ?? '').trim()
  const visibility = formData.get('visibility') as string

  if (!body) return { error: 'Comment body is required.' }
  if (body.length > 2000) return { error: 'Comment must be 2 000 characters or fewer.' }
  if (visibility !== 'internal' && visibility !== 'external') return { error: 'Invalid visibility.' }

  const request = await prisma.maintenanceRequest.findFirst({
    where: { id: requestId, property: { ownerId: session.userId } },
    select: {
      id: true,
      title: true,
      submittedByName: true,
      submittedByEmail: true,
      property: { select: { name: true } },
      unit: { select: { label: true } },
    },
  })
  if (!request) return { error: 'Request not found.' }

  try {
    await prisma.requestComment.create({
      data: { requestId, body, visibility, authorUserId: session.userId },
    })
    await writeAuditLog({
      orgId: session.userId,
      actorUserId: session.userId,
      entityType: 'request',
      entityId: requestId,
      action: 'request.commentAdded',
      summary: `Added ${visibility} comment.`,
      metadata: { visibility },
    })
    revalidatePath(`/requests/${requestId}`)
    if (
      visibility === 'external' &&
      request.submittedByEmail &&
      request.submittedByName &&
      await areEmailNotificationsEnabled(session.userId)
    ) {
      await sendNotification(buildTenantCommentMessage({
        requestId,
        title: request.title,
        propertyName: request.property.name,
        unitLabel: request.unit.label,
        tenantEmail: request.submittedByEmail,
        tenantName: request.submittedByName,
        comment: body,
        actionUrl: tenantRequestActionUrl(requestId),
      }), { ownerUserId: session.userId, requestId })
    }
    return { error: null, success: true }
  } catch (error) {
    await logServerActionError('request.comment.add', error, { requestId, visibility })
    return { error: 'Could not save comment. Database may not be connected.' }
  }
}

function centsFromDollarsInput(raw: string) {
  const value = raw.trim()
  if (!value) return 0
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null
  return Math.round(Number(value) * 100)
}

async function upsertVendorRemittanceDraft(
  tx: Prisma.TransactionClient,
  input: {
    requestId: string
    vendorId: string
    vendorName: string
    vendorEmail: string | null
    userId: string
    approvedItemId?: string
  },
) {
  const [request, awardedInvite, commercialItems] = await Promise.all([
    tx.maintenanceRequest.findUnique({
      where: { id: input.requestId },
      include: { property: true, unit: true },
    }),
    tx.tenderInvite.findFirst({
      where: { requestId: input.requestId, vendorId: input.vendorId, status: 'awarded' },
      orderBy: { awardedAt: 'desc' },
    }),
    tx.vendorCommercialItem.findMany({
      where: { requestId: input.requestId, vendorId: input.vendorId, status: { in: ['approved', 'submitted'] } },
      orderBy: { submittedAt: 'asc' },
    }),
  ])

  if (!request) return null

  const approvedBid = commercialItems.find((item) => item.itemType === 'bid' && item.status === 'approved')
  const assignedSubmittedBid = request.assignedVendorId === input.vendorId
    ? commercialItems.find((item) => item.itemType === 'bid' && item.status === 'submitted')
    : undefined
  const extraItems = commercialItems.filter((item) => item.itemType !== 'bid' && item.status === 'approved')
  const extrasCents = extraItems.reduce((sum, item) => sum + item.amountCents, 0)
  const existingDraft = await tx.billingDocument.findFirst({
    where: {
      requestId: input.requestId,
      recipientType: 'vendor',
      documentType: 'vendor_remittance',
      status: 'draft',
      sentTo: input.vendorEmail,
    },
    orderBy: { createdAt: 'desc' },
  })
  const previouslyApprovedExtrasCents = extraItems
    .filter((item) => item.id !== input.approvedItemId)
    .reduce((sum, item) => sum + item.amountCents, 0)
  const existingBaseCents = existingDraft
    ? Math.max(existingDraft.totalCents - previouslyApprovedExtrasCents, 0)
    : 0
  const recordedBidCents = Math.max(
    awardedInvite?.bidAmountCents ?? 0,
    approvedBid?.amountCents ?? 0,
    assignedSubmittedBid?.amountCents ?? 0,
  )
  const bidCents = Math.max(recordedBidCents, existingBaseCents)
  const totalCents = bidCents + extrasCents
  if (totalCents <= 0) return null

  const title = `Vendor payment - ${input.vendorName}`
  const descriptionLines = [
    `Amount owed to ${input.vendorName} for ${request.title}.`,
    bidCents > 0 ? `${recordedBidCents > 0 ? 'Approved bid' : 'Approved vendor amount'}: USD ${(bidCents / 100).toFixed(2)}` : null,
    ...extraItems.map((item) => `${item.title}: USD ${(item.amountCents / 100).toFixed(2)}`),
  ].filter(Boolean) as string[]
  const description = descriptionLines.join('\n')
  const pdfHtml = renderBillingPdfHtml({
    title,
    recipientLabel: input.vendorName,
    documentType: 'vendor_remittance',
    status: 'draft',
    amountCents: totalCents,
    paidCents: 0,
    currency: request.preferredCurrency,
    description,
    requestTitle: request.title,
    propertyName: request.property.name,
    unitLabel: request.unit.label,
  })

  if (existingDraft) {
    const updated = await tx.billingDocument.update({
      where: { id: existingDraft.id },
      data: {
        totalCents,
        paidCents: 0,
        title,
        description,
        pdfUrl: `data:text/html;charset=utf-8,${encodeURIComponent(pdfHtml)}`,
        events: {
          create: {
            actorUserId: input.userId,
            eventType: 'payment_state_updated',
            note: 'Updated draft from approved vendor submissions.',
          },
        },
      },
    })
    return updated
  }

  return tx.billingDocument.create({
    data: {
      requestId: input.requestId,
      recipientType: 'vendor',
      documentType: 'vendor_remittance',
      status: 'draft',
      currency: request.preferredCurrency,
      totalCents,
      paidCents: 0,
      title,
      description,
      pdfUrl: `data:text/html;charset=utf-8,${encodeURIComponent(pdfHtml)}`,
      sentTo: input.vendorEmail,
      createdByUserId: input.userId,
      events: {
        create: {
          actorUserId: input.userId,
          eventType: 'created',
          note: 'Draft vendor payment created from approved vendor submissions.',
        },
      },
    },
  })
}

export async function updateTenantBillbackAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const requestId = String(formData.get('requestId') ?? '')
  const decision = String(formData.get('tenantBillbackDecision') ?? 'none').trim() as 'none' | 'bill_tenant' | 'waived'
  const amountRaw = String(formData.get('tenantBillbackAmount') ?? '')
  const reason = String(formData.get('tenantBillbackReason') ?? '').trim()

  if (!['none', 'bill_tenant', 'waived'].includes(decision)) return { error: 'Invalid bill-back decision.' }

  const amountCents = centsFromDollarsInput(amountRaw)
  if (amountCents == null) return { error: 'Invalid tenant bill-back amount.' }
  if (amountCents < 0) return { error: 'Bill-back amount cannot be negative.' }
  if (decision === 'bill_tenant' && amountCents <= 0) return { error: 'Bill tenant requires an amount greater than zero.' }
  if (decision !== 'none' && !reason) return { error: 'A reason is required for bill-back decisions.' }

  try {
    await prisma.maintenanceRequest.update({
      where: { id: requestId, property: { ownerId: session.userId } },
      data: {
        tenantBillbackDecision: decision,
        tenantBillbackAmountCents: decision === 'none' ? 0 : amountCents,
        tenantBillbackReason: decision === 'none' ? null : reason,
        tenantBillbackDecidedAt: decision === 'none' ? null : new Date(),
        tenantBillbackDecidedByUserId: decision === 'none' ? null : session.userId,
      },
    })

    await writeAuditLog({
      orgId: session.userId,
      actorUserId: session.userId,
      entityType: 'request',
      entityId: requestId,
      action: 'request.billbackUpdated',
      summary: `Updated tenant bill-back decision to ${decision}.`,
      metadata: { decision, amountCents: decision === 'none' ? 0 : amountCents, reason: reason || null },
    })

    await applyRequestAutomation(requestId)
    revalidatePath(`/requests/${requestId}`)
    revalidatePath('/reports')
    return { error: null, success: true }
  } catch (error) {
    await logServerActionError('request.billback.update', error, { requestId, decision })
    return { error: 'Could not update tenant bill-back decision.' }
  }
}
