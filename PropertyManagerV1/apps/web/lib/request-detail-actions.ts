'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type { RequestStatus } from '@/lib/types'

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

  try {
    await prisma.$transaction(async (tx) => {
      await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          status: toStatus,
          closedAt: toStatus === 'done' ? new Date() : null,
        },
      })
      await tx.statusEvent.create({
        data: { requestId, fromStatus, toStatus },
      })
    })
    revalidatePath(`/requests/${requestId}`)
    revalidatePath('/dashboard')
    return { error: null, success: true }
  } catch {
    return { error: 'Could not update status. Database may not be connected.' }
  }
}

export async function updateVendorFormAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const requestId = formData.get('requestId') as string
  const vendorName = ((formData.get('vendorName') as string) ?? '').trim()

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
