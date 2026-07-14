import { beforeEach, describe, expect, test, vi } from 'vitest'
import { saveInspectionAction } from '@/app/inspections/actions'
import { getLandlordSession } from '@/lib/landlord-session'
import { savePhotos, validatePhotoFiles } from '@/lib/photo-upload'
import { prisma } from '@/lib/prisma'
import { scaffoldLandlord } from '@/test/helpers'

vi.mock('@/lib/landlord-session')
vi.mock('@/lib/photo-upload', () => ({
  savePhotos: vi.fn().mockResolvedValue(['uploads/inspections/evidence.jpg']),
  validatePhotoFiles: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/outlook-calendar-sync', () => ({ syncOutlookCalendarForUser: vi.fn().mockResolvedValue(undefined) }))

describe('saveInspectionAction', () => {
  beforeEach(() => {
    vi.mocked(savePhotos).mockResolvedValue(['uploads/inspections/evidence.jpg'])
    vi.mocked(validatePhotoFiles).mockResolvedValue(null)
  })

  test('preserves every answer and uploaded photo when required evidence is incomplete', async () => {
    const { user, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue({ userId: user.id, email: user.email } as never)
    const inspection = await prisma.inspection.create({
      data: {
        orgId: user.id,
        unitId: unit.id,
        title: 'Routine inspection',
        inspectionType: 'routine',
        templateName: 'Routine inspection',
        requirePhotoForIssues: true,
        requireNoteForIssues: true,
        items: {
          create: [
            { section: 'Safety', label: 'Smoke detector', position: 0 },
            { section: 'Condition', label: 'Window damage', position: 1 },
          ],
        },
      },
      include: { items: { orderBy: { position: 'asc' } } },
    })
    const [passedItem, findingItem] = inspection.items
    const form = new FormData()
    form.set('inspectionId', inspection.id)
    form.set('intent', 'complete')
    form.set(`result:${passedItem.id}`, 'pass')
    form.set(`note:${passedItem.id}`, '')
    form.set(`result:${findingItem.id}`, 'needs_attention')
    form.set(`note:${findingItem.id}`, '')
    form.set(`photo:${findingItem.id}`, new File(['photo'], 'window.jpg', { type: 'image/jpeg' }))

    await expect(saveInspectionAction(form)).rejects.toThrow(new RegExp(`missingNotes=${findingItem.id}`))

    const saved = await prisma.inspection.findUniqueOrThrow({
      where: { id: inspection.id },
      include: { items: { orderBy: { position: 'asc' } } },
    })
    expect(saved.status).toBe('draft')
    expect(saved.items[0].result).toBe('pass')
    expect(saved.items[1]).toMatchObject({
      result: 'needs_attention',
      note: null,
      photoUrl: 'uploads/inspections/evidence.jpg',
    })
  })
})
