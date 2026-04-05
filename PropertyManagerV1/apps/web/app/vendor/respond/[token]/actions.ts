'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { markVendorDispatchLinkUsed, validateVendorDispatchToken } from '@/lib/vendor-dispatch-link'
import { cleanupPhotos, savePhotos, validatePhotoFiles } from '@/lib/photo-upload'
import { buildTenantVendorUpdateMessage, sendNotification } from '@/lib/notify'
import { applyRequestAutomation } from '@/lib/automation'
import type { DispatchStatus } from '@/lib/types'

export type VendorResponseState = { error: string | null }

const VALID_STATUSES: DispatchStatus[] = ['contacted', 'accepted', 'declined', 'scheduled', 'completed']

export async function submitVendorResponse(
  _prev: VendorResponseState,
  formData: FormData,
): Promise<VendorResponseState> {
  const token = String(formData.get('token') ?? '')
  const dispatchStatus = String(formData.get('dispatchStatus') ?? '') as DispatchStatus
  const note = String(formData.get('note') ?? '').trim()
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

  if (scheduledStart && Number.isNaN(scheduledStart.getTime())) return { error: 'Invalid scheduled start.' }
  if (scheduledEnd && Number.isNaN(scheduledEnd.getTime())) return { error: 'Invalid scheduled end.' }
  if (scheduledStart && scheduledEnd && scheduledEnd < scheduledStart) return { error: 'Scheduled end must be after start.' }

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
      const reviewState = dispatchStatus === 'completed'
        ? 'vendor_completed_pending_review'
        : dispatchStatus === 'declined'
          ? 'vendor_declined_reassignment_needed'
          : savedPhotoPaths.length > 0
            ? 'vendor_update_pending_review'
            : 'none'
      const reviewNote = dispatchStatus === 'completed'
        ? 'Vendor marked work complete. Awaiting landlord review.'
        : dispatchStatus === 'declined'
          ? 'Vendor declined assignment. Reassignment needed.'
          : savedPhotoPaths.length > 0
            ? 'Vendor provided photo evidence. Review if tenant-visible follow-up is needed.'
            : null

      const updatedRequest = await tx.maintenanceRequest.update({
        where: { id: validation.requestId },
        data: {
          dispatchStatus,
          vendorScheduledStart: scheduledStart,
          vendorScheduledEnd: scheduledEnd,
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
          note: note || null,
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
