import { readImageHeader, validateImageMagicBytes } from '@/lib/image-validation'
import { getMediaContentType, storeMediaObject, deleteStoredMedia } from '@/lib/media-storage'

export const MAX_PHOTO_COUNT = 5
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024

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

  const savedPaths: string[] = []

  for (const file of files) {
    const extension = getFileExtension(file)
    const bytes = Buffer.from(await file.arrayBuffer())
    const storagePath = await storeMediaObject(bytes, extension, getMediaContentType(file.name || `file.${extension}`))
    savedPaths.push(storagePath)
  }

  return savedPaths
}

export async function cleanupPhotos(photoPaths: string[]) {
  await Promise.all(photoPaths.map((photoPath) => deleteStoredMedia(photoPath)))
}
