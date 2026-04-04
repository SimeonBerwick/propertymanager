'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import type { CurrencyOption, LanguageOption, RequestStatus } from '@/lib/types'
import { sendNotification, buildStatusChangedMessage, buildVendorAssignedMessage } from '@/lib/notify'

export type RequestActionState = { error: string | null; success?: boolean }

const VALID_STATUSES: RequestStatus[] = ['new', 'scheduled', 'in_progress', 'done']

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

export async function updateStatusFormAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

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
        where: { id: requestId, property: { ownerId: session.userId } },
        data: {
          status: toStatus,
          closedAt: toStatus === 'done' ? new Date() : null,
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
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  const requestId = formData.get('requestId') as string
  const vendorName = ((formData.get('vendorName') as string) ?? '').trim()
  const vendorEmail = ((formData.get('vendorEmail') as string) ?? '').trim().toLowerCase()
  const vendorPhone = ((formData.get('vendorPhone') as string) ?? '').trim()

  if (vendorName.length > 120) return { error: 'Vendor name must be 120 characters or fewer.' }
  if (vendorEmail.length > 254) return { error: 'Vendor email must be 254 characters or fewer.' }
  if (vendorPhone.length > 40) return { error: 'Vendor phone must be 40 characters or fewer.' }
  if (vendorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendorEmail)) return { error: 'Vendor email is invalid.' }

  let notificationPayload:
    | {
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
      }
    | undefined

  try {
    const updated = await prisma.maintenanceRequest.update({
      where: { id: requestId, property: { ownerId: session.userId } },
      data: {
        assignedVendorName: vendorName || null,
        assignedVendorEmail: vendorEmail || null,
        assignedVendorPhone: vendorPhone || null,
      },
      include: { property: true, unit: true },
    })

    if (vendorName && vendorEmail) {
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
      }
    }

    revalidatePath(`/requests/${requestId}`)
  } catch {
    return { error: 'Could not update vendor. Database may not be connected.' }
  }

  if (notificationPayload) {
    await sendNotification(buildVendorAssignedMessage(notificationPayload))
  }

  return { error: null, success: true }
}

export async function updatePreferencesFormAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  const requestId = formData.get('requestId') as string
  const preferredCurrency = ((formData.get('preferredCurrency') as string) ?? '').trim() as CurrencyOption
  const preferredLanguage = ((formData.get('preferredLanguage') as string) ?? '').trim() as LanguageOption

  if (!['usd', 'peso', 'pound', 'euro'].includes(preferredCurrency)) {
    return { error: 'Invalid currency.' }
  }

  if (!['english', 'spanish', 'french'].includes(preferredLanguage)) {
    return { error: 'Invalid language.' }
  }

  const { triageTags, slaBucket } = deriveTriageMeta(preferredCurrency, preferredLanguage)
  const triageTagsCsv = triageTags.join(',')

  try {
    await prisma.maintenanceRequest.update({
      where: { id: requestId, property: { ownerId: session.userId } },
      data: {
        preferredCurrency,
        preferredLanguage,
        triageTagsCsv,
        slaBucket,
      },
    })

    revalidatePath(`/requests/${requestId}`)
    revalidatePath('/dashboard')
    return { error: null, success: true }
  } catch {
    return { error: 'Could not update preferences. Database may not be connected.' }
  }
}

export async function addCommentFormAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  const requestId = formData.get('requestId') as string
  const body = ((formData.get('body') as string) ?? '').trim()
  const visibility = formData.get('visibility') as string

  if (!body) return { error: 'Comment body is required.' }
  if (body.length > 2000) return { error: 'Comment must be 2 000 characters or fewer.' }
  if (visibility !== 'internal' && visibility !== 'external') return { error: 'Invalid visibility.' }

  // Verify the request belongs to this org before writing the comment.
  const request = await prisma.maintenanceRequest.findFirst({
    where: { id: requestId, property: { ownerId: session.userId } },
    select: { id: true },
  })
  if (!request) return { error: 'Request not found.' }

  try {
    await prisma.requestComment.create({
      data: { requestId, body, visibility, authorUserId: session.userId },
    })
    revalidatePath(`/requests/${requestId}`)
    return { error: null, success: true }
  } catch {
    return { error: 'Could not save comment. Database may not be connected.' }
  }
}
