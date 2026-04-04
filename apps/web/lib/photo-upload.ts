import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { readImageHeader, validateImageMagicBytes } from '@/lib/image-validation'

export const MAX_PHOTO_COUNT = 5
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024
export const UPLOAD_SUBDIRECTORY = path.join('uploads', 'requests')

function getFileExtension(file: File) {
  const extensionFromType = file.type.split('/')[1]?.toLowerCase()
  const extensionFromName = file.name.split('.').pop()?.toLowerCase()
  return extensionFromType || extensionFromName || 'jpg'
}

export async function validatePhotoFiles(files: File[]) {
  if (files.length > MAX_PHOTO_COUNT) {
    return `Upload up to ${MAX_PHOTO_COUNT} photos.`
  }

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      return 'Photos must be image files.'
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      return 'Each photo must be 5 MB or smaller.'
    }

    const header = await readImageHeader(file)
    if (!validateImageMagicBytes(header)) {
      return 'Photos must be valid image files.'
    }
  }

  return null
}

export async function savePhotos(files: File[]) {
  if (!files.length) return [] as string[]

  const diskDirectory = path.join(process.cwd(), UPLOAD_SUBDIRECTORY)
  await mkdir(diskDirectory, { recursive: true })

  const savedPaths: string[] = []

  for (const file of files) {
    const extension = getFileExtension(file)
    const filename = `${Date.now()}-${randomUUID()}.${extension}`
    const diskPath = path.join(diskDirectory, filename)
    const storagePath = `${UPLOAD_SUBDIRECTORY}/${filename}`
    const bytes = Buffer.from(await file.arrayBuffer())

    await writeFile(diskPath, bytes)
    savedPaths.push(storagePath)
  }

  return savedPaths
}

export async function cleanupPhotos(photoPaths: string[]) {
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
