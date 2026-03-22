'use server'

import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'

export type SubmitRequestState = { error: string | null }

const MAX_PHOTO_COUNT = 5
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024
const UPLOAD_SUBDIRECTORY = path.join('uploads', 'requests')

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function isUrgency(value: string): value is (typeof REQUEST_URGENCIES)[number] {
  return REQUEST_URGENCIES.includes(value as (typeof REQUEST_URGENCIES)[number])
}

function getFileExtension(file: File) {
  const extensionFromType = file.type.split('/')[1]?.toLowerCase()
  const extensionFromName = file.name.split('.').pop()?.toLowerCase()
  return extensionFromType || extensionFromName || 'jpg'
}

async function savePhotos(files: File[]) {
  if (!files.length) {
    return [] as string[]
  }

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

async function cleanupPhotos(photoPaths: string[]) {
  await Promise.all(
    photoPaths.map(async (photoPath) => {
      const diskPath = path.join(process.cwd(), 'public', photoPath.replace(/^\//, ''))
      try {
        await unlink(diskPath)
      } catch {
        // Best effort cleanup only.
      }
    }),
  )
}

export async function submitMaintenanceRequest(
  _prevState: SubmitRequestState,
  formData: FormData,
): Promise<SubmitRequestState> {
  const propertyId = getString(formData, 'propertyId')
  const unitId = getString(formData, 'unitId')
  const tenantName = getString(formData, 'tenantName')
  const tenantEmail = getString(formData, 'tenantEmail').toLowerCase()
  const title = getString(formData, 'title')
  const description = getString(formData, 'description')
  const category = getString(formData, 'category')
  const urgency = getString(formData, 'urgency')
  const photoFiles = formData
    .getAll('photos')
    .filter((value): value is File => value instanceof File && value.size > 0)

  if (!propertyId || !unitId || !tenantName || !tenantEmail || !title || !description || !category || !urgency) {
    return { error: 'All required fields must be filled in.' }
  }

  if (!REQUEST_CATEGORIES.includes(category as (typeof REQUEST_CATEGORIES)[number])) {
    return { error: 'Choose a valid maintenance category.' }
  }

  if (!isUrgency(urgency)) {
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

  const savedPhotoPaths = await savePhotos(photoFiles)

  try {
    const request = await prisma.$transaction(async (tx) => {
      const createdRequest = await tx.maintenanceRequest.create({
        data: {
          propertyId,
          unitId,
          submittedByName: tenantName,
          submittedByEmail: tenantEmail,
          title,
          description,
          category,
          urgency,
          status: 'new',
          photos: {
            create: savedPhotoPaths.map((imageUrl) => ({ imageUrl })),
          },
          comments: {
            create: [
              {
                body: `Submitted by ${tenantName} (${tenantEmail}).`,
                visibility: 'external',
              },
            ],
          },
          events: {
            create: [
              {
                toStatus: 'new',
              },
            ],
          },
        },
      })

      return createdRequest
    })

    redirect(`/submit?submitted=${request.id}`)
  } catch {
    await cleanupPhotos(savedPhotoPaths)
    return { error: 'Submission is wired, but request creation needs a configured Postgres database. Set DATABASE_URL, run the migration, and seed it.' }
  }
}
