'use server'

import path from 'node:path'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDatabaseAvailable } from '@/lib/db-status'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'
import { getLandlordEmail } from '@/lib/auth-config'
import { sendNotification, buildNewRequestMessages } from '@/lib/notify'
import { getLandlordBySlug } from '@/lib/data'
import { cleanupPhotos, savePhotos, validatePhotoFiles } from '@/lib/photo-upload'
import { logServerActionError } from '@/lib/observability'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { getLandlordSession } from '@/lib/landlord-session'
import { isCurrencyOption, type CurrencyOption } from '@/lib/types'

export type SubmitRequestState = { error: string | null }

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

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function isUrgency(value: string): value is (typeof REQUEST_URGENCIES)[number] {
  return REQUEST_URGENCIES.includes(value as (typeof REQUEST_URGENCIES)[number])
}

export async function submitMaintenanceRequest(
  _prevState: SubmitRequestState,
  formData: FormData,
): Promise<SubmitRequestState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode — no database connected. Request submission is disabled.' }
  }

  const orgSlug = getString(formData, 'orgSlug') || undefined
  const managerMode = getString(formData, 'managerMode') === 'true'
  const propertyId = getString(formData, 'propertyId')
  const unitId = getString(formData, 'unitId')
  let tenantName = getString(formData, 'tenantName')
  let tenantEmail = getString(formData, 'tenantEmail').toLowerCase()
  const title = getString(formData, 'title')
  const description = getString(formData, 'description')
  const category = getString(formData, 'category')
  const urgency = getString(formData, 'urgency')
  const preferredCurrency = getString(formData, 'preferredCurrency') || 'usd'
  const preferredLanguage = getString(formData, 'preferredLanguage') || 'english'
  const photoFiles = formData
    .getAll('photos')
    .filter((value): value is File => value instanceof File && value.size > 0)

  if (!propertyId || !unitId || (!managerMode && (!tenantName || !tenantEmail)) || !title || !description || !category || !urgency) {
    return { error: 'All required fields must be filled in.' }
  }

  if (!isCurrencyOption(preferredCurrency)) {
    return { error: 'Choose a valid preferred currency.' }
  }

  if (!['english', 'spanish', 'french'].includes(preferredLanguage)) {
    return { error: 'Choose a valid preferred language.' }
  }

  if (tenantName.length > 120) return { error: 'Name must be 120 characters or fewer.' }
  if (tenantEmail.length > 254) return { error: 'Email address is too long.' }
  if (title.length > 200) return { error: 'Issue title must be 200 characters or fewer.' }
  if (description.length > 2000) return { error: 'Description must be 2 000 characters or fewer.' }

  if (!REQUEST_CATEGORIES.includes(category as (typeof REQUEST_CATEGORIES)[number])) {
    return { error: 'Choose a valid maintenance category.' }
  }

  if (!isUrgency(urgency)) {
    return { error: 'Choose a valid urgency level.' }
  }

  const photoError = await validatePhotoFiles(photoFiles)
  if (photoError) {
    return { error: photoError }
  }

  let verifiedLandlordId: string | undefined
  let notificationOwner: { id: string; email: string; emailNotificationsEnabled: boolean } | undefined

  if (managerMode) {
    const session = await getLandlordSession()
    if (!session) return { error: 'Sign in again to create a work order.' }
    verifiedLandlordId = session.userId
  } else if (orgSlug) {
    const landlord = await getLandlordBySlug(orgSlug)
    if (!landlord) {
      return { error: 'Invalid submission link. Please use the link provided by your property manager.' }
    }
    verifiedLandlordId = landlord.id
  }

  let propertyName = 'Unknown property'
  let unitLabel = 'Unknown unit'
  let isCommonArea = false
  try {
    const unit = await prisma.unit.findFirst({
      where: {
        id: unitId,
        propertyId,
        isActive: true,
        property: {
          isActive: true,
          ...(verifiedLandlordId ? { ownerId: verifiedLandlordId } : {}),
        },
      },
      include: {
        property: {
          include: {
            owner: { select: { id: true, email: true, emailNotificationsEnabled: true } },
          },
        },
      },
    })
    if (!unit) {
      return { error: 'The selected property or unit is no longer available for new requests.' }
    }
    if (managerMode) {
      isCommonArea = unit.locationType === 'common_area'
      tenantName = isCommonArea ? 'Property manager' : unit.tenantName?.trim() ?? ''
      tenantEmail = isCommonArea ? '' : unit.tenantEmail?.trim().toLowerCase() ?? ''
      if (!isCommonArea && (!tenantName || !tenantEmail)) {
        return { error: 'This unit needs a resident name and email before you can create a manager work order.' }
      }
    }
    unitLabel = unit.label
    propertyName = unit.property.name
    notificationOwner = unit.property.owner
  } catch (error) {
    await logServerActionError('request.verifyUnit', error, { propertyId, unitId, orgSlug })
    return { error: 'Could not verify property or unit. Please try again.' }
  }

  const savedPhotoPaths = await savePhotos(photoFiles)

  let createdRequestId: string
  const { triageTags, slaBucket } = deriveTriageMeta(preferredCurrency, preferredLanguage)
  const triageTagsCsv = triageTags.join(',')
  const initialStatus = managerMode ? 'approved' : 'requested'

  try {
    const request = await prisma.$transaction(async (tx) => {
      return tx.maintenanceRequest.create({
        data: {
          propertyId,
          unitId,
          submittedByName: tenantName,
          submittedByEmail: tenantEmail || null,
          preferredCurrency: preferredCurrency as CurrencyOption,
          preferredLanguage: preferredLanguage as 'english' | 'spanish' | 'french',
          slaBucket,
          triageTagsCsv,
          title,
          description,
          category,
          urgency,
          status: initialStatus,
          firstReviewedAt: managerMode ? new Date() : undefined,
          reviewState: managerMode ? 'approved' : undefined,
          reviewNote: managerMode ? 'Created by property manager.' : undefined,
          photos: {
            create: savedPhotoPaths.map((imageUrl) => ({ imageUrl })),
          },
          comments: {
            create: [
              {
                body: isCommonArea ? 'Created by the property manager for a common area.' : `Submitted by ${tenantName} (${tenantEmail}).`,
                visibility: 'external',
              },
            ],
          },
          events: {
            create: [{ toStatus: initialStatus }],
          },
        },
      })
    })

    createdRequestId = request.id
    await prisma.productEvent.create({ data: { orgId: notificationOwner?.id, eventName: 'request_submitted', metadataJson: JSON.stringify({ requestId: request.id, category }) } }).catch(() => null)
  } catch (error) {
    await logServerActionError('request.submit', error, { propertyId, unitId, orgSlug, photoCount: savedPhotoPaths.length })
    await cleanupPhotos(savedPhotoPaths)
    return { error: 'Could not submit your request. Please try again or contact the property manager directly.' }
  }

  // Notifications are best-effort — sendNotification never throws.
  if (notificationOwner?.emailNotificationsEnabled !== false) {
    const [tenantMsg, landlordMsg] = buildNewRequestMessages({
      requestId: createdRequestId,
      title,
      propertyName,
      unitLabel,
      tenantName,
      tenantEmail,
      landlordEmail: notificationOwner?.email ?? getLandlordEmail(),
      urgency,
      category,
      description,
      preferredCurrency,
      preferredLanguage,
      tenantActionUrl: `${getAppBaseUrl('tenant new request notification links')}/mobile/requests/${createdRequestId}`,
      landlordActionUrl: `${getAppBaseUrl('landlord new request notification links')}/requests/${createdRequestId}`,
    })
    await Promise.all([
      ...(tenantEmail ? [sendNotification(tenantMsg, { ownerUserId: notificationOwner?.id, requestId: createdRequestId })] : []),
      sendNotification(landlordMsg, { ownerUserId: notificationOwner?.id, requestId: createdRequestId }),
    ])
  }

  const successUrl = orgSlug
    ? `/submit/${orgSlug}?submitted=${createdRequestId}`
    : `/submit?submitted=${createdRequestId}${managerMode ? '&mode=manager' : ''}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redirect(successUrl as any)
}
