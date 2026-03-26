'use server'

import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDatabaseAvailable } from '@/lib/db-status'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'
import { getLandlordEmail } from '@/lib/auth-config'
import { sendNotification, buildNewRequestMessages } from '@/lib/notify'
import { getLandlordBySlug } from '@/lib/data'
import { validateImageMagicBytes, readImageHeader } from '@/lib/image-validation'

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

async function cleanupPhotos(photoPaths: string[]) {
  await Promise.all(
    photoPaths.map(async (photoPath) => {
      const diskPath = path.join(process.cwd(), photoPath)
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
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode — no database connected. Request submission is disabled.' }
  }

  const orgSlug = getString(formData, 'orgSlug') || undefined
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

  // When the form was served from /submit/[orgSlug], verify the submitted property
  // actually belongs to that landlord — prevents cross-org request injection.
  if (orgSlug) {
    const landlord = await getLandlordBySlug(orgSlug)
    if (!landlord) {
      return { error: 'Invalid submission link. Please use the link provided by your property manager.' }
    }
    try {
      const prop = await prisma.property.findUnique({ where: { id: propertyId }, select: { ownerId: true } })
      if (!prop || prop.ownerId !== landlord.id) {
        return { error: 'The selected property is not valid for this submission link.' }
      }
    } catch {
      return { error: 'Could not verify property. Please try again.' }
    }
  }

  const savedPhotoPaths = await savePhotos(photoFiles)

  // Fetch the unit so we can include property name + unit label in notifications.
  let propertyName = 'Unknown property'
  let unitLabel = 'Unknown unit'
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: { property: true },
    })
    if (unit) {
      unitLabel = unit.label
      propertyName = unit.property.name
    }
  } catch {
    // Non-fatal — we still have IDs; notifications will use fallback labels.
  }

  let createdRequestId: string

  try {
    const request = await prisma.$transaction(async (tx) => {
      return tx.maintenanceRequest.create({
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
            create: [{ toStatus: 'new' }],
          },
        },
      })
    })

    createdRequestId = request.id
  } catch {
    await cleanupPhotos(savedPhotoPaths)
    return { error: 'Could not submit your request. Please try again or contact the property manager directly.' }
  }

  // Notifications are best-effort — sendNotification never throws.
  const [tenantMsg, landlordMsg] = buildNewRequestMessages({
    requestId: createdRequestId,
    title,
    propertyName,
    unitLabel,
    tenantName,
    tenantEmail,
    landlordEmail: getLandlordEmail(),
    urgency,
    category,
    description,
  })
  await Promise.all([sendNotification(tenantMsg), sendNotification(landlordMsg)])

  const successUrl = orgSlug
    ? `/submit/${orgSlug}?submitted=${createdRequestId}`
    : `/submit?submitted=${createdRequestId}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redirect(successUrl as any)
}
