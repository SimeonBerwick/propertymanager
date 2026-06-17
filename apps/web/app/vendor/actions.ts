'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireVendorSession } from '@/lib/vendor-session'
import { cleanupPhotos, savePhotos, validatePhotoFiles } from '@/lib/photo-upload'
import { buildTenantVendorUpdateMessage, sendNotification } from '@/lib/notify'
import { applyRequestAutomation } from '@/lib/automation'
import type { DispatchStatus, RequestStatus } from '@/lib/types'
import { buildVendorRequestVisibilityWhere } from '@/lib/vendor-portal-data'

export type VendorPortalResponseState = { error: string | null }

const VALID_STATUSES: DispatchStatus[] = ['contacted', 'accepted', 'declined', 'scheduled', 'completed', 'canceled']

export async function submitVendorPortalResponse(
  _prev: VendorPortalResponseState,
  formData: FormData,
): Promise<VendorPortalResponseState> {
  const session = await requireVendorSession()
  const requestId = String(formData.get('requestId') ?? '')
  const dispatchStatus = String(formData.get('dispatchStatus') ?? '') as DispatchStatus
  const note = String(formData.get('note') ?? '').trim()
  const bidAmountRaw = String(formData.get('bidAmount') ?? '').trim()
  const availabilityNote = String(formData.get('availabilityNote') ?? '').trim()
  const scheduledStartRaw = String(formData.get('scheduledStart') ?? '').trim()
  const scheduledEndRaw = String(formData.get('scheduledEnd') ?? '').trim()
  const photoFiles = formData.getAll('photos').filter((value): value is File => value instanceof File && value.size > 0)

  if (!requestId) return { error: 'Request is required.' }
  if (!VALID_STATUSES.includes(dispatchStatus)) return { error: 'Invalid response status.' }

  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      ...buildVendorRequestVisibilityWhere(session),
    },
    select: {
      id: true,
      assignedVendorId: true,
      title: true,
      submittedByEmail: true,
      submittedByName: true,
      property: { select: { name: true, owner: { select: { id: true, emailNotificationsEnabled: true } } } },
      unit: { select: { label: true } },
      tenderInvites: {
        where: { vendorId: session.vendorId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true },
      },
      _count: { select: { photos: true } },
    },
  })

  if (!request) return { error: 'This request is not available for your vendor account.' }

  const photoError = await validatePhotoFiles(photoFiles, request._count.photos)
  if (photoError) return { error: photoError }

  const scheduledStart = scheduledStartRaw ? new Date(scheduledStartRaw) : null
  const scheduledEnd = scheduledEndRaw ? new Date(scheduledEndRaw) : null
  const bidAmountCents = bidAmountRaw ? Math.round(Number(bidAmountRaw) * 100) : null

  if (scheduledStart && Number.isNaN(scheduledStart.getTime())) return { error: 'Invalid scheduled start.' }
  if (scheduledEnd && Number.isNaN(scheduledEnd.getTime())) return { error: 'Invalid scheduled end.' }
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
      const tenderInvite = request.tenderInvites[0]
      const tenderInviteId = tenderInvite?.id
      const canControlDispatch = request.assignedVendorId === session.vendorId || tenderInvite?.status === 'awarded'
      if (tenderInviteId) {
        const nextInviteStatus = dispatchStatus === 'declined'
          ? 'declined'
          : tenderInvite?.status === 'awarded'
            ? 'awarded'
            : dispatchStatus === 'completed' || dispatchStatus === 'accepted' || dispatchStatus === 'scheduled'
              ? 'bid_submitted'
              : 'viewed'
        await tx.tenderInvite.update({
          where: { id: tenderInviteId },
          data: {
            status: nextInviteStatus,
            bidAmountCents: bidAmountRaw ? bidAmountCents : undefined,
            bidCurrency: bidAmountRaw ? 'usd' : undefined,
            bidSource: bidAmountRaw ? 'vendor_submitted' : undefined,
            availabilityNote: availabilityNote || null,
            proposedStart: scheduledStart,
            proposedEnd: scheduledEnd,
            viewedAt: new Date(),
            respondedAt: new Date(),
          },
        })
      }

      const reviewState = dispatchStatus === 'completed'
        ? 'vendor_completed_pending_review'
        : dispatchStatus === 'declined' || dispatchStatus === 'canceled'
          ? 'vendor_declined_reassignment_needed'
          : 'vendor_update_pending_review'
      const reviewNote = dispatchStatus === 'completed'
        ? 'Vendor marked work complete. Review and close if no tenant-visible follow-up is needed.'
        : dispatchStatus === 'declined' || dispatchStatus === 'canceled'
          ? 'Vendor declined or canceled. Reassign if work is still needed.'
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

      const before = await tx.maintenanceRequest.findUnique({
        where: { id: request.id },
        select: { status: true },
      })

      if (canControlDispatch) {
        await tx.maintenanceRequest.update({
          where: { id: request.id },
          data: {
            assignedVendorId: dispatchStatus === 'declined' || dispatchStatus === 'canceled' ? null : undefined,
            assignedVendorName: dispatchStatus === 'declined' || dispatchStatus === 'canceled' ? null : undefined,
            assignedVendorEmail: dispatchStatus === 'declined' || dispatchStatus === 'canceled' ? null : undefined,
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

      if (canControlDispatch && request.submittedByEmail && request.submittedByName) {
        tenantNotification = {
          tenantEmail: request.submittedByEmail,
          tenantName: request.submittedByName,
          requestId: request.id,
          title: request.title,
          propertyName: request.property.name,
          unitLabel: request.unit.label,
          vendorName: session.vendorName,
          ownerUserId: request.property.owner.id,
          emailNotificationsEnabled: request.property.owner.emailNotificationsEnabled,
        }
      }

      if (!canControlDispatch && savedPhotoPaths.length) {
        throw new Error('Photos are only allowed for the awarded or assigned vendor.')
      }

      const dispatchEvent = canControlDispatch
        ? await tx.vendorDispatchEvent.create({
            data: {
              requestId: request.id,
              vendorId: session.vendorId,
              status: dispatchStatus,
              note: [note, availabilityNote, bidAmountCents != null ? `Bid: USD ${(bidAmountCents / 100).toFixed(2)}` : null].filter(Boolean).join(' · ') || null,
              scheduledStart,
              scheduledEnd,
            },
          })
        : null

      if (dispatchEvent && savedPhotoPaths.length) {
        await tx.maintenancePhoto.createMany({
          data: savedPhotoPaths.map((imageUrl) => ({
            requestId: request.id,
            dispatchEventId: dispatchEvent.id,
            imageUrl,
            source: 'vendor',
            sourceLabel: session.vendorName,
          })),
        })
      }

      if (canControlDispatch && requestStatus && before && requestStatus !== before.status) {
        await tx.statusEvent.create({
          data: {
            requestId: request.id,
            fromStatus: before.status,
            toStatus: requestStatus,
            visibility: dispatchStatus === 'scheduled' || dispatchStatus === 'completed' ? 'tenant_visible' : 'internal',
          },
        })
      }
    })
  } catch {
    await cleanupPhotos(savedPhotoPaths)
    return { error: 'Could not save vendor response.' }
  }

  await applyRequestAutomation(request.id)

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
    }), { ownerUserId: tenantNotification.ownerUserId, requestId: tenantNotification.requestId })
  }

  redirect(`/vendor/requests/${request.id}?submitted=1` as never)
}
