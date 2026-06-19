'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'
import { cleanupPhotos, savePhotos, validatePhotoFiles } from '@/lib/photo-upload'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { buildNewRequestMessages, sendNotification } from '@/lib/notify'
import { logServerActionError } from '@/lib/observability'
import { getAppBaseUrl } from '@/lib/runtime-env'

export type MobileRequestState = { error: string | null }

function isRedirectLikeError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const maybe = error as { message?: unknown; digest?: unknown }
  const message = typeof maybe.message === 'string' ? maybe.message : ''
  const digest = typeof maybe.digest === 'string' ? maybe.digest : ''
  return message.startsWith('NEXT_REDIRECT:') || digest.startsWith('NEXT_REDIRECT:')
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

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function submitTenantMobileRequestAction(
  _prev: MobileRequestState,
  formData: FormData,
): Promise<MobileRequestState> {
  const session = await requireTenantMobileSession()
  const title = getString(formData, 'title')
  const description = getString(formData, 'description')
  const category = getString(formData, 'category')
  const urgency = getString(formData, 'urgency')
  const preferredCurrency = getString(formData, 'preferredCurrency') || 'usd'
  const preferredLanguage = getString(formData, 'preferredLanguage') || 'english'
  const photoFiles = formData.getAll('photos').filter((value): value is File => value instanceof File && value.size > 0)

  if (!title || !description || !category || !urgency) {
    return { error: 'All fields are required.' }
  }

  if (preferredCurrency !== 'usd') {
    return { error: 'Choose a valid preferred currency.' }
  }

  if (!['english', 'spanish', 'french'].includes(preferredLanguage)) {
    return { error: 'Choose a valid preferred language.' }
  }

  if (!REQUEST_CATEGORIES.includes(category as (typeof REQUEST_CATEGORIES)[number])) {
    return { error: 'Choose a valid maintenance category.' }
  }

  if (!REQUEST_URGENCIES.includes(urgency as (typeof REQUEST_URGENCIES)[number])) {
    return { error: 'Choose a valid urgency level.' }
  }

  const photoError = await validatePhotoFiles(photoFiles)
  if (photoError) {
    return { error: photoError }
  }

  const photoPaths = await savePhotos(photoFiles)
  const { triageTags, slaBucket } = deriveTriageMeta(preferredCurrency, preferredLanguage)
  const triageTagsCsv = triageTags.join(',')

  const activeUnit = await prisma.unit.findFirst({
    where: {
      id: session.unitId,
      propertyId: session.propertyId,
      isActive: true,
      property: { id: session.propertyId, isActive: true },
    },
    select: {
      id: true,
      label: true,
      property: {
        select: {
          name: true,
          owner: { select: { id: true, email: true, emailNotificationsEnabled: true } },
        },
      },
    },
  })

  if (!activeUnit) {
    return { error: 'This unit is no longer active for new requests. Contact your property manager.' }
  }

  let requestId: string
  try {
    const request = await prisma.maintenanceRequest.create({
      data: {
        propertyId: session.propertyId,
        unitId: session.unitId,
        orgId: session.orgId,
        tenantIdentityId: session.tenantIdentityId,
        submittedByName: session.tenantName,
        submittedByEmail: session.email ?? undefined,
        preferredCurrency: preferredCurrency as 'usd' | 'peso' | 'pound' | 'euro',
        preferredLanguage: preferredLanguage as 'english' | 'spanish' | 'french',
        slaBucket,
        triageTagsCsv,
        title,
        description,
        category,
        urgency: urgency as 'low' | 'medium' | 'high' | 'urgent',
        status: 'requested',
        photos: {
          create: photoPaths.map((imageUrl) => ({ imageUrl })),
        },
        comments: {
          create: [{ body: `Submitted from tenant mobile portal by ${session.tenantName}.`, visibility: 'external' }],
        },
        events: {
          create: [{ toStatus: 'requested', visibility: 'tenant_visible' }],
        },
      },
    })
    requestId = request.id
  } catch (error) {
    await logServerActionError('tenantMobile.request.submit', error, {
      orgId: session.orgId,
      propertyId: session.propertyId,
      unitId: session.unitId,
      tenantIdentityId: session.tenantIdentityId,
      photoCount: photoPaths.length,
    })
    await cleanupPhotos(photoPaths)
    if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
      return { error: `Could not submit your request. ${error.message}` }
    }
    return { error: 'Could not submit your request. Please try again or contact the property manager.' }
  }

  if (session.email && activeUnit.property.owner.emailNotificationsEnabled) {
    const [tenantMsg, landlordMsg] = buildNewRequestMessages({
      requestId,
      title,
      propertyName: activeUnit.property.name,
      unitLabel: activeUnit.label,
      tenantName: session.tenantName,
      tenantEmail: session.email,
      landlordEmail: activeUnit.property.owner.email,
      urgency,
      category,
      description,
      preferredCurrency,
      preferredLanguage,
      tenantActionUrl: `${getAppBaseUrl('tenant new request notification links')}/mobile/requests/${requestId}`,
      landlordActionUrl: `${getAppBaseUrl('landlord new request notification links')}/requests/${requestId}`,
    })
    await Promise.all([
      sendNotification(tenantMsg, { ownerUserId: activeUnit.property.owner.id, requestId }),
      sendNotification(landlordMsg, { ownerUserId: activeUnit.property.owner.id, requestId }),
    ])
  }

  redirect(`/mobile/requests/${requestId}` as never)
}
