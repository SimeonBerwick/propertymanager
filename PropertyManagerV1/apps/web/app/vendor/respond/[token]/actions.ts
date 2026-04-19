'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { markVendorDispatchLinkUsed, validateVendorDispatchToken } from '@/lib/vendor-dispatch-link'
import { cleanupPhotos, savePhotos, validatePhotoFiles } from '@/lib/photo-upload'
import { buildTenantVendorUpdateMessage, sendNotification } from '@/lib/notify'
import { applyRequestAutomation } from '@/lib/automation'
import type { DispatchStatus, RequestStatus } from '@/lib/types'

export type VendorResponseState = { error: string | null }

const VALID_STATUSES: DispatchStatus[] = ['contacted', 'accepted', 'declined', 'scheduled', 'completed', 'canceled']

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

  const photoError = await validatePhotoFiles(photoFiles)
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
      }
    | undefined

  try {
    await prisma.$transaction(async (tx) => {
      if (validation.tenderInviteId) {
        await tx.tenderInvite.update({
          where: { id: validation.tenderInviteId },
          data: {
            status: dispatchStatus === 'declined' ? 'declined' : dispatchStatus === 'completed' || dispatchStatus === 'accepted' || dispatchStatus === 'scheduled' ? 'bid_submitted' : 'viewed',
            bidAmountCents,
            bidCurrency: bidAmountRaw ? 'usd' : null,
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

      const updatedRequest = await tx.maintenanceRequest.update({
        where: { id: validation.requestId },
        data: {
          dispatchStatus,
          vendorScheduledStart: scheduledStart,
          vendorScheduledEnd: scheduledEnd,
          status: requestStatus,
          reviewState,
          reviewNote,
        },
        include: {
          property: true,
          unit: true,
        },
      })

      if (updatedRequest.submittedByEmail && updatedRequest.submittedByName) {
        tenantNotification = {
          tenantEmail: updatedRequest.submittedByEmail,
          tenantName: updatedRequest.submittedByName,
          requestId: updatedRequest.id,
          title: updatedRequest.title,
          propertyName: updatedRequest.property.name,
          unitLabel: updatedRequest.unit.label,
          vendorName: validation.vendorName,
        }
      }

      const dispatchEvent = await tx.vendorDispatchEvent.create({
        data: {
          requestId: validation.requestId,
          vendorId: validation.vendorId,
          status: dispatchStatus,
          note: [note, availabilityNote, bidAmountCents != null ? `Bid: USD ${(bidAmountCents / 100).toFixed(2)}` : null].filter(Boolean).join(' · ') || null,
          scheduledStart,
          scheduledEnd,
        },
      })

      if (savedPhotoPaths.length) {
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

      if (requestStatus && requestStatus !== updatedRequest.status) {
        await tx.statusEvent.create({
          data: {
            requestId: validation.requestId,
            fromStatus: updatedRequest.status,
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

  await markVendorDispatchLinkUsed(validation.linkId)

  await applyRequestAutomation(validation.requestId)

  const shouldNotifyTenant = dispatchStatus === 'scheduled' || dispatchStatus === 'completed' || savedPhotoPaths.length > 0
  if (shouldNotifyTenant && tenantNotification) {
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
    }))
  }

  redirect(`/vendor/respond/${token}?submitted=1`)
}
