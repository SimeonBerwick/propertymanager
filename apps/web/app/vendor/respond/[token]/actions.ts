'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { markVendorDispatchLinkUsed, validateVendorDispatchToken } from '@/lib/vendor-dispatch-link'
import { cleanupPhotos, savePhotos, validatePhotoFiles } from '@/lib/photo-upload'
import { buildTenantVendorUpdateMessage, sendNotification } from '@/lib/notify'
import { applyRequestAutomation } from '@/lib/automation'
import { getAppBaseUrl } from '@/lib/runtime-env'
import type { DispatchStatus, RequestStatus } from '@/lib/types'
import { logServerActionError } from '@/lib/observability'
import { parseDateTimeLocalInDisplayTimeZone } from '@/lib/appointment-time'

export type VendorResponseState = { error: string | null }

const VALID_STATUSES: DispatchStatus[] = ['contacted', 'accepted', 'declined', 'scheduled', 'completed', 'canceled']

function tenantRequestActionUrl(requestId: string) {
  return `${getAppBaseUrl('tenant vendor update notifications')}/mobile/requests/${requestId}`
}

export async function submitVendorResponse(
  _prev: VendorResponseState,
  formData: FormData,
): Promise<VendorResponseState> {
  const token = String(formData.get('token') ?? '')
  const dispatchStatus = String(formData.get('dispatchStatus') ?? '') as DispatchStatus
  const note = String(formData.get('note') ?? '').trim()
  const bidAmountRaw = String(formData.get('bidAmount') ?? '').trim()
  const availabilityNote = String(formData.get('availabilityNote') ?? '').trim()
  const scheduledStartRaw = String(formData.get('scheduledStart') ?? '').trim()
  const scheduledEndRaw = String(formData.get('scheduledEnd') ?? '').trim()
  const photoFiles = formData.getAll('photos').filter((value): value is File => value instanceof File && value.size > 0)

  if (!VALID_STATUSES.includes(dispatchStatus)) {
    return { error: 'Invalid response status.' }
  }

  const validation = await validateVendorDispatchToken(token)
  if (!validation.ok) {
    return { error: 'This vendor response link is invalid or expired.' }
  }

  const existingPhotoCount = await prisma.maintenancePhoto.count({
    where: { requestId: validation.requestId },
  })
  const photoError = await validatePhotoFiles(photoFiles, existingPhotoCount)
  if (photoError) return { error: photoError }

  const scheduledStart = scheduledStartRaw ? parseDateTimeLocalInDisplayTimeZone(scheduledStartRaw) : null
  const scheduledEnd = scheduledEndRaw ? parseDateTimeLocalInDisplayTimeZone(scheduledEndRaw) : null
  const bidAmountCents = bidAmountRaw ? Math.round(Number(bidAmountRaw) * 100) : null

  if (dispatchStatus === 'scheduled' && !scheduledStartRaw) return { error: 'Enter the appointment start time before marking work scheduled.' }
  if (scheduledStart && Number.isNaN(scheduledStart.getTime())) return { error: 'Enter a valid scheduled start time.' }
  if (scheduledEnd && Number.isNaN(scheduledEnd.getTime())) return { error: 'Enter a valid scheduled end time.' }
  if (scheduledStart && scheduledEnd && scheduledEnd < scheduledStart) return { error: 'Scheduled end must be after start.' }
  if (bidAmountRaw && (!Number.isFinite(Number(bidAmountRaw)) || Number(bidAmountRaw) < 0)) return { error: 'Invalid bid amount.' }

  const savedPhotoPaths = await savePhotos(photoFiles)
  let tenantNotification:
    | {
        tenantEmail: string
        tenantName: string
        requestId: string
        title: string
        propertyName: string
        unitLabel: string
        vendorName: string
        ownerUserId: string
        emailNotificationsEnabled: boolean
      }
    | undefined

  try {
    await prisma.$transaction(async (tx) => {
      const currentRequest = await tx.maintenanceRequest.findUnique({
        where: { id: validation.requestId },
        select: {
          assignedVendorId: true,
          status: true,
          preferredCurrency: true,
          submittedByEmail: true,
          submittedByName: true,
          title: true,
          property: { select: { name: true, owner: { select: { id: true, emailNotificationsEnabled: true } } } },
          unit: { select: { label: true } },
        },
      })

      if (!currentRequest) {
        throw new Error('Request not found.')
      }

      const currentInvite = validation.tenderInviteId
        ? await tx.tenderInvite.findUnique({
            where: { id: validation.tenderInviteId },
            select: { id: true, tenderId: true, status: true },
          })
        : null
      if (currentInvite?.status === 'not_awarded' && dispatchStatus === 'accepted' && !bidAmountRaw) {
        throw new Error('REVISED_BID_AMOUNT_REQUIRED')
      }
      const acceptsWorkWithoutBid = !!currentInvite
        && !currentRequest.assignedVendorId
        && currentInvite.status !== 'not_awarded'
        && !bidAmountRaw
        && ['accepted', 'scheduled', 'completed'].includes(dispatchStatus)
      const canControlDispatch = currentRequest.assignedVendorId === validation.vendorId
        || currentInvite?.status === 'awarded'
        || acceptsWorkWithoutBid

      if (validation.tenderInviteId) {
        const nextInviteStatus = dispatchStatus === 'declined'
          ? 'declined'
          : currentInvite?.status === 'awarded'
            ? 'awarded'
            : acceptsWorkWithoutBid
              ? 'awarded'
              : dispatchStatus === 'completed' || dispatchStatus === 'accepted' || dispatchStatus === 'scheduled'
                ? 'bid_submitted'
                : 'viewed'
        await tx.tenderInvite.update({
          where: { id: validation.tenderInviteId },
          data: {
            status: nextInviteStatus,
            bidAmountCents: bidAmountRaw ? bidAmountCents : undefined,
            bidCurrency: bidAmountRaw ? currentRequest.preferredCurrency : undefined,
            availabilityNote: availabilityNote || null,
            proposedStart: scheduledStart,
            proposedEnd: scheduledEnd,
            awardedAt: acceptsWorkWithoutBid ? new Date() : undefined,
            viewedAt: new Date(),
            respondedAt: new Date(),
          },
        })
        if (acceptsWorkWithoutBid && currentInvite.tenderId) {
          await tx.tenderInvite.updateMany({
            where: { tenderId: currentInvite.tenderId, id: { not: validation.tenderInviteId }, status: { in: ['invited', 'viewed', 'bid_submitted', 'withdrawn'] } },
            data: { status: 'not_awarded' },
          })
          await tx.requestTender.update({
            where: { id: currentInvite.tenderId },
            data: { status: 'awarded', awardedAt: new Date(), closedAt: new Date() },
          })
        }
      }

      const reviewState = dispatchStatus === 'completed'
        ? 'vendor_completed_pending_review'
        : dispatchStatus === 'declined' || dispatchStatus === 'canceled'
          ? 'vendor_declined_reassignment_needed'
          : savedPhotoPaths.length > 0
            ? 'vendor_update_pending_review'
            : 'none'
      const reviewNote = dispatchStatus === 'completed'
        ? 'Vendor marked work complete. Awaiting landlord review.'
        : dispatchStatus === 'declined' || dispatchStatus === 'canceled'
          ? 'Vendor cannot continue with this assignment. Reassignment needed.'
          : savedPhotoPaths.length > 0
            ? 'Vendor provided photo evidence. Review if tenant-visible follow-up is needed.'
            : null
      const requestStatus: RequestStatus | undefined = dispatchStatus === 'scheduled'
        ? 'scheduled'
        : dispatchStatus === 'completed'
          ? 'completed'
          : dispatchStatus === 'declined' || dispatchStatus === 'canceled'
            ? 'approved'
            : dispatchStatus === 'accepted'
              ? 'vendor_selected'
              : undefined

      if (canControlDispatch) {
        await tx.maintenanceRequest.update({
          where: { id: validation.requestId },
          data: {
            assignedVendorId: dispatchStatus === 'declined' || dispatchStatus === 'canceled' ? null : acceptsWorkWithoutBid ? validation.vendorId : undefined,
            assignedVendorName: dispatchStatus === 'declined' || dispatchStatus === 'canceled' ? null : acceptsWorkWithoutBid ? validation.vendorName : undefined,
            assignedVendorEmail: dispatchStatus === 'declined' || dispatchStatus === 'canceled' ? null : acceptsWorkWithoutBid ? validation.vendorEmail : undefined,
            assignedVendorPhone: dispatchStatus === 'declined' || dispatchStatus === 'canceled' ? null : undefined,
            dispatchStatus,
            vendorScheduledStart: dispatchStatus === 'declined' || dispatchStatus === 'canceled' ? null : scheduledStart,
            vendorScheduledEnd: dispatchStatus === 'declined' || dispatchStatus === 'canceled' ? null : scheduledEnd,
            status: requestStatus,
            reviewState,
            reviewNote,
          },
        })
      }

      if (canControlDispatch && currentRequest.submittedByEmail && currentRequest.submittedByName) {
        tenantNotification = {
          tenantEmail: currentRequest.submittedByEmail,
          tenantName: currentRequest.submittedByName,
          requestId: validation.requestId,
          title: currentRequest.title,
          propertyName: currentRequest.property.name,
          unitLabel: currentRequest.unit.label,
          vendorName: validation.vendorName,
          ownerUserId: currentRequest.property.owner.id,
          emailNotificationsEnabled: currentRequest.property.owner.emailNotificationsEnabled,
        }
      }

      if (!canControlDispatch && savedPhotoPaths.length) {
        throw new Error('Photos are only allowed for the awarded or assigned vendor.')
      }

      const dispatchEvent = canControlDispatch
        ? await tx.vendorDispatchEvent.create({
            data: {
              requestId: validation.requestId,
              vendorId: validation.vendorId,
              status: dispatchStatus,
              note: [note, availabilityNote, bidAmountCents != null ? `Bid: USD ${(bidAmountCents / 100).toFixed(2)}` : null].filter(Boolean).join(' - ') || null,
              scheduledStart,
              scheduledEnd,
            },
          })
        : null

      if (dispatchEvent && savedPhotoPaths.length) {
        await tx.maintenancePhoto.createMany({
          data: savedPhotoPaths.map((imageUrl) => ({
            requestId: validation.requestId,
            dispatchEventId: dispatchEvent.id,
            imageUrl,
            source: 'vendor',
            sourceLabel: validation.vendorName,
          })),
        })
      }

      if (canControlDispatch && requestStatus && requestStatus !== currentRequest.status) {
        await tx.statusEvent.create({
          data: {
            requestId: validation.requestId,
            fromStatus: currentRequest.status,
            toStatus: requestStatus,
            visibility: dispatchStatus === 'scheduled' || dispatchStatus === 'completed' ? 'tenant_visible' : 'internal',
          },
        })
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'REVISED_BID_AMOUNT_REQUIRED') {
      await cleanupPhotos(savedPhotoPaths)
      return { error: 'Enter the revised bid amount before sending it back to the property manager.' }
    }
    await logServerActionError('vendorToken.response.submit', error, {
      requestId: validation.requestId,
      vendorId: validation.vendorId,
      dispatchStatus,
      photoCount: savedPhotoPaths.length,
    })
    await cleanupPhotos(savedPhotoPaths)
    return { error: 'Could not save vendor response.' }
  }

  await markVendorDispatchLinkUsed(validation.linkId)

  await applyRequestAutomation(validation.requestId)

  const shouldNotifyTenant = dispatchStatus === 'scheduled' || dispatchStatus === 'completed' || savedPhotoPaths.length > 0
  if (shouldNotifyTenant && tenantNotification?.emailNotificationsEnabled) {
    await sendNotification(buildTenantVendorUpdateMessage({
      tenantEmail: tenantNotification.tenantEmail,
      tenantName: tenantNotification.tenantName,
      requestId: tenantNotification.requestId,
      title: tenantNotification.title,
      propertyName: tenantNotification.propertyName,
      unitLabel: tenantNotification.unitLabel,
      vendorName: tenantNotification.vendorName,
      dispatchStatus,
      note: note || undefined,
      scheduledStart: scheduledStart?.toISOString(),
      scheduledEnd: scheduledEnd?.toISOString(),
      photoCount: savedPhotoPaths.length || undefined,
      actionUrl: tenantRequestActionUrl(tenantNotification.requestId),
    }), { ownerUserId: tenantNotification.ownerUserId, requestId: tenantNotification.requestId })
  }

  redirect(`/vendor/respond/${token}?submitted=1`)
}
