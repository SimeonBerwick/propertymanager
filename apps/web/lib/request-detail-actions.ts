'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { RequestStatus } from '@/lib/types'
import { sendNotification, buildStatusChangedMessage } from '@/lib/notify'

export type RequestActionState = { error: string | null; success?: boolean }

const INITIAL_STATE: RequestActionState = { error: null }
export { INITIAL_STATE }

const VALID_STATUSES: RequestStatus[] = ['new', 'scheduled', 'in_progress', 'done']

export async function updateStatusFormAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const requestId = formData.get('requestId') as string
  const fromStatus = formData.get('fromStatus') as RequestStatus
  const toStatus = formData.get('toStatus') as RequestStatus

  if (!VALID_STATUSES.includes(toStatus)) return { error: 'Invalid status.' }
  if (toStatus === fromStatus) return { error: 'Request is already in that status.' }

  let tenantEmail: string | undefined
  let tenantName: string | undefined
  let title: string | undefined
  let propertyName: string | undefined
  let unitLabel: string | undefined

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          status: toStatus,
          closedAt: toStatus === 'done' ? new Date() : null,
        },
        include: { property: true, unit: true },
      })
      await tx.statusEvent.create({
        data: { requestId, fromStatus, toStatus },
      })

      tenantEmail = updated.submittedByEmail ?? undefined
      tenantName = updated.submittedByName ?? undefined
      title = updated.title
      propertyName = updated.property.name
      unitLabel = updated.unit.label
    })
  } catch {
    return { error: 'Could not update status. Database may not be connected.' }
  }

  revalidatePath(`/requests/${requestId}`)
  revalidatePath('/dashboard')

  // Notify tenant if we have their email (best-effort, never throws).
  if (tenantEmail && tenantName && title && propertyName && unitLabel) {
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
      }),
    )
  }

  return { error: null, success: true }
}

export async function updateVendorFormAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const requestId = formData.get('requestId') as string
  const vendorName = ((formData.get('vendorName') as string) ?? '').trim()

  if (vendorName.length > 120) return { error: 'Vendor name must be 120 characters or fewer.' }

  try {
    await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: { assignedVendorName: vendorName || null },
    })
    revalidatePath(`/requests/${requestId}`)
    return { error: null, success: true }
  } catch {
    return { error: 'Could not update vendor. Database may not be connected.' }
  }
}

export async function addCommentFormAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const requestId = formData.get('requestId') as string
  const body = ((formData.get('body') as string) ?? '').trim()
  const visibility = formData.get('visibility') as string

  if (!body) return { error: 'Comment body is required.' }
  if (body.length > 2000) return { error: 'Comment must be 2 000 characters or fewer.' }
  if (visibility !== 'internal' && visibility !== 'external') return { error: 'Invalid visibility.' }

  try {
    await prisma.requestComment.create({
      data: { requestId, body, visibility },
    })
    revalidatePath(`/requests/${requestId}`)
    return { error: null, success: true }
  } catch {
    return { error: 'Could not save comment. Database may not be connected.' }
  }
}
