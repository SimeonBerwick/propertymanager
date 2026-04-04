'use server'

import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { validateImageMagicBytes, readImageHeader } from '@/lib/image-validation'

const MAX_PHOTO_COUNT = 5
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024
const UPLOAD_SUBDIRECTORY = path.join('uploads', 'requests')

export type MobileRequestState = { error: string | null }

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

function getFileExtension(file: File) {
  const extensionFromType = file.type.split('/')[1]?.toLowerCase()
  const extensionFromName = file.name.split('.').pop()?.toLowerCase()
  return extensionFromType || extensionFromName || 'jpg'
}

async function savePhotos(files: File[]) {
  if (!files.length) return [] as string[]

  const diskDirectory = path.join(process.cwd(), UPLOAD_SUBDIRECTORY)
  await mkdir(diskDirectory, { recursive: true })
  const savedPaths: string[] = []

  for (const file of files) {
    const extension = getFileExtension(file)
    const filename = `${Date.now()}-${randomUUID()}.${extension}`
    const diskPath = path.join(diskDirectory, filename)
    // Store as a relative path from cwd — not a public URL.
    const storagePath = `${UPLOAD_SUBDIRECTORY}/${filename}`
    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(diskPath, bytes)
    savedPaths.push(storagePath)
  }

  return savedPaths
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

  if (photoFiles.length > MAX_PHOTO_COUNT) {
    return { error: `Upload up to ${MAX_PHOTO_COUNT} photos.` }
  }

  for (const file of photoFiles) {
    if (!file.type.startsWith('image/')) {
      return { error: 'Photos must be image files.' }
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      return { error: 'Each photo must be 5 MB or smaller.' }
    }
    const header = await readImageHeader(file)
    if (!validateImageMagicBytes(header)) {
      return { error: 'Photos must be valid image files.' }
    }
  }

  const photoPaths = await savePhotos(photoFiles)
  const { triageTags, slaBucket } = deriveTriageMeta(preferredCurrency, preferredLanguage)
  const triageTagsCsv = triageTags.join(',')

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
      status: 'new',
      photos: {
        create: photoPaths.map((imageUrl) => ({ imageUrl })),
      },
      comments: {
        create: [{ body: `Submitted from tenant mobile portal by ${session.tenantName}.`, visibility: 'external' }],
      },
      events: {
        create: [{ toStatus: 'new', visibility: 'tenant_visible' }],
      },
    },
  })

  redirect(`/mobile/requests/${request.id}` as never)
}
