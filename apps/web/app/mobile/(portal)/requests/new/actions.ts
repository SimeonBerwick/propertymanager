'use server'

import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'

const MAX_PHOTO_COUNT = 5
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024
const UPLOAD_SUBDIRECTORY = path.join('uploads', 'requests')

export type MobileRequestState = { error: string | null }

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

  const diskDirectory = path.join(process.cwd(), 'public', UPLOAD_SUBDIRECTORY)
  await mkdir(diskDirectory, { recursive: true })
  const savedPaths: string[] = []

  for (const file of files) {
    const extension = getFileExtension(file)
    const filename = `${Date.now()}-${randomUUID()}.${extension}`
    const diskPath = path.join(diskDirectory, filename)
    const publicPath = `/${UPLOAD_SUBDIRECTORY}/${filename}`
    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(diskPath, bytes)
    savedPaths.push(publicPath)
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
  const photoFiles = formData.getAll('photos').filter((value): value is File => value instanceof File && value.size > 0)

  if (!title || !description || !category || !urgency) {
    return { error: 'All fields are required.' }
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
  }

  const photoPaths = await savePhotos(photoFiles)

  const request = await prisma.maintenanceRequest.create({
    data: {
      propertyId: session.propertyId,
      unitId: session.unitId,
      orgId: session.orgId,
      tenantIdentityId: session.tenantIdentityId,
      submittedByName: session.tenantName,
      submittedByEmail: session.email ?? undefined,
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
