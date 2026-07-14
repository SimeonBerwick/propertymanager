import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { readImageHeader, validateImageMagicBytes } from '@/lib/image-validation'
import { deleteStoredMedia, saveStoredMedia } from '@/lib/media-storage'
import { hasR2StorageConfig } from '@/lib/runtime-env'
import { assertEmergencyFeatureEnabled, emergencyFeatureMessage, isEmergencyFeatureDisabled } from '@/lib/feature-switches'

export const MAX_VENDOR_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024
export const VENDOR_ATTACHMENT_SUBDIRECTORY = path.join('uploads', 'requests', 'vendor-invoices')

export type SavedVendorAttachment = {
  url: string
  name: string
  contentType: string
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120) || 'vendor-invoice'
}

function fileExtension(file: File) {
  const extensionFromName = file.name.split('.').pop()?.toLowerCase()
  if (extensionFromName) return extensionFromName
  if (file.type === 'application/pdf') return 'pdf'
  return file.type.split('/')[1]?.toLowerCase() || 'bin'
}

async function isPdf(file: File) {
  const header = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString('utf8')
  return header === '%PDF-'
}

export async function validateVendorAttachment(file: File | null) {
  if (!file || file.size === 0) return null
  if (isEmergencyFeatureDisabled('uploads')) return emergencyFeatureMessage('uploads')
  if (file.size > MAX_VENDOR_ATTACHMENT_SIZE_BYTES) return 'Invoice attachment must be 10 MB or smaller.'

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return await isPdf(file) ? null : 'PDF attachments must be valid PDF files.'
  }

  if (file.type.startsWith('image/')) {
    const header = await readImageHeader(file)
    return validateImageMagicBytes(header) ? null : 'Image attachments must be valid image files.'
  }

  return 'Attach a PDF or image of the bill.'
}

export async function saveVendorAttachment(file: File | null): Promise<SavedVendorAttachment | null> {
  if (!file || file.size === 0) return null
  assertEmergencyFeatureEnabled('uploads')

  const shouldWriteLocalDisk = !hasR2StorageConfig()
  const diskDirectory = path.join(process.cwd(), VENDOR_ATTACHMENT_SUBDIRECTORY)
  if (shouldWriteLocalDisk) {
    await mkdir(diskDirectory, { recursive: true })
  }

  const extension = fileExtension(file)
  const cleanName = sanitizeFileName(file.name)
  const filename = `${Date.now()}-${randomUUID()}-${cleanName}.${extension}`
  const storagePath = `${VENDOR_ATTACHMENT_SUBDIRECTORY}/${filename}`.replace(/\\/g, '/')
  const diskPath = path.join(diskDirectory, filename)
  const bytes = Buffer.from(await file.arrayBuffer())
  const contentType = file.type || (extension === 'pdf' ? 'application/pdf' : 'application/octet-stream')

  await saveStoredMedia(storagePath, bytes, contentType)
  if (shouldWriteLocalDisk) {
    await writeFile(diskPath, bytes)
  }

  return {
    url: storagePath,
    name: file.name || cleanName,
    contentType,
  }
}

export async function cleanupVendorAttachment(attachment: SavedVendorAttachment | null) {
  if (!attachment) return
  await deleteStoredMedia(attachment.url)
  try {
    await unlink(path.join(process.cwd(), attachment.url))
  } catch {
    // Best effort cleanup only.
  }
}
