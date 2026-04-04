'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { markVendorDispatchLinkUsed, validateVendorDispatchToken } from '@/lib/vendor-dispatch-link'
import { cleanupPhotos, savePhotos, validatePhotoFiles } from '@/lib/photo-upload'
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

  try {
    await prisma.$transaction(async (tx) => {
      await tx.maintenanceRequest.update({
        where: { id: validation.requestId },
        data: {
          dispatchStatus,
          vendorScheduledStart: scheduledStart,
          vendorScheduledEnd: scheduledEnd,
        },
      })

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

  redirect(`/vendor/respond/${token}?submitted=1`)
}
