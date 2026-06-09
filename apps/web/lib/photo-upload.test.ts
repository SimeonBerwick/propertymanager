import { beforeEach, describe, expect, test, vi } from 'vitest'

const saveStoredMediaMock = vi.fn()
const mkdirMock = vi.fn()
const writeFileMock = vi.fn()

vi.mock('@/lib/media-storage', () => ({
  saveStoredMedia: saveStoredMediaMock,
  deleteStoredMedia: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  unlink: vi.fn(),
  writeFile: writeFileMock,
}))

describe('photo-upload', () => {
  beforeEach(() => {
    saveStoredMediaMock.mockReset().mockResolvedValue('uploads/requests/test.png')
    mkdirMock.mockReset().mockResolvedValue(undefined)
    writeFileMock.mockReset().mockResolvedValue(undefined)
  })

  test('does not touch local disk when R2 storage is configured', async () => {
    process.env.R2_ACCOUNT_ID = 'acct'
    process.env.R2_ACCESS_KEY_ID = 'key'
    process.env.R2_SECRET_ACCESS_KEY = 'secret'
    process.env.R2_BUCKET = 'bucket'

    const { savePhotos } = await import('@/lib/photo-upload')
    const file = new File([Buffer.from('png-bytes')], 'proof.png', { type: 'image/png' })

    await savePhotos([file])

    expect(mkdirMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
    expect(saveStoredMediaMock).toHaveBeenCalledTimes(1)
  })

  test('rejects photos that would put a work order over the three-photo limit', async () => {
    const { validatePhotoFiles } = await import('@/lib/photo-upload')
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    const files = [
      new File([jpegHeader], 'one.jpg', { type: 'image/jpeg' }),
      new File([jpegHeader], 'two.jpg', { type: 'image/jpeg' }),
    ]

    await expect(validatePhotoFiles(files, 2)).resolves.toMatch(/3 photos/i)
  })

  test('allows a photo-free update on a legacy work order already over the limit', async () => {
    const { validatePhotoFiles } = await import('@/lib/photo-upload')

    await expect(validatePhotoFiles([], 5)).resolves.toBeNull()
  })
})
