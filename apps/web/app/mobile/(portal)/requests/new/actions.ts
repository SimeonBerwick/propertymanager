'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'
import { cleanupPhotos, savePhotos, validatePhotoFiles } from '@/lib/photo-upload'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'

export type MobileRequestState = { error: string | null }

function isRedirectLikeError(error: unknown) {
  if (!(error instanceof Error)) return false
  const digest = 'digest' in error ? String((error as Error & { digest?: string }).digest ?? '') : ''
  return error.message.startsWith('NEXT_REDIRECT:') || digest.startsWith('NEXT_REDIRECT:')
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

  if (!['usd', 'peso', 'pound', 'euro'].includes(preferredCurrency)) {
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
    select: { id: true },
  })

  if (!activeUnit) {
    return { error: 'This unit is no longer active for new requests. Contact your property manager.' }
  }

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

    redirect(`/mobile/requests/${request.id}` as never)
  } catch (error) {
    if (isRedirectLikeError(error)) {
      throw error
    }
    await cleanupPhotos(photoPaths)
    return { error: 'Could not submit your request. Please try again or contact the property manager.' }
  }
}
