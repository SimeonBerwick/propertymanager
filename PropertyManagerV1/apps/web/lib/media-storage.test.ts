import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const sendMock = vi.fn()

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = sendMock
  },
  GetObjectCommand: class { constructor(public input: unknown) {} },
  PutObjectCommand: class { constructor(public input: unknown) {} },
  DeleteObjectCommand: class { constructor(public input: unknown) {} },
}))

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env = { ...originalEnv }
  sendMock.mockReset()
})

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('media-storage', () => {
  test('normalizes legacy public paths', async () => {
    const { normalizeStoredMediaPath } = await import('@/lib/media-storage')
    expect(normalizeStoredMediaPath('/uploads/requests/photo.jpg')).toBe('uploads/requests/photo.jpg')
  })

  test('writes to R2 when configured', async () => {
    process.env.R2_ACCOUNT_ID = 'acct'
    process.env.R2_ACCESS_KEY_ID = 'key'
    process.env.R2_SECRET_ACCESS_KEY = 'secret'
    process.env.R2_BUCKET = 'bucket'
    sendMock.mockResolvedValueOnce({})

    const { saveStoredMedia } = await import('@/lib/media-storage')
    const saved = await saveStoredMedia('uploads/requests/photo.jpg', Buffer.from('hi'), 'image/jpeg')

    expect(saved).toBe('uploads/requests/photo.jpg')
    expect(sendMock).toHaveBeenCalledTimes(1)
  })
})
