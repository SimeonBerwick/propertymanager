import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
  buildChangedCsvExports: vi.fn(),
  sendNotification: vi.fn(),
  writeAuditLog: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
      update: mocks.update,
      findMany: mocks.findMany,
    },
  },
}))
vi.mock('@/lib/csv-export', () => ({ buildChangedCsvExports: mocks.buildChangedCsvExports }))
vi.mock('@/lib/notify', () => ({ sendNotification: mocks.sendNotification }))
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: mocks.writeAuditLog }))

import { sendDailyCsvExportToLandlord } from '@/lib/daily-csv-export'

const now = new Date('2026-06-10T12:00:00.000Z')
const user = {
  id: 'user-1',
  email: 'landlord@example.com',
  emailNotificationsEnabled: true,
  dailyCsvExportEnabled: true,
  dailyCsvExportLastSentAt: new Date('2026-06-09T11:00:00.000Z'),
}

describe('daily CSV exports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findUnique.mockResolvedValue(user)
    mocks.update.mockResolvedValue(user)
    mocks.writeAuditLog.mockResolvedValue(undefined)
  })

  test('emails only changed CSV files and advances the cursor after delivery', async () => {
    mocks.buildChangedCsvExports.mockResolvedValue([
      { kind: 'units', filename: 'units.csv', content: 'id\n1', rowCount: 1 },
      { kind: 'vendors', filename: 'vendors.csv', content: 'id', rowCount: 0 },
      { kind: 'tickets', filename: 'tickets.csv', content: 'id\n2\n3', rowCount: 2 },
    ])
    mocks.sendNotification.mockResolvedValue({ ok: true })

    const result = await sendDailyCsvExportToLandlord(user.id, now)

    expect(result).toEqual({ ok: true, skipped: false, files: 2 })
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({ filename: 'units.csv' }),
          expect.objectContaining({ filename: 'tickets.csv' }),
        ],
      }),
      { ownerUserId: user.id, transportHint: 'system', bypassUserPreference: true },
    )
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { dailyCsvExportLastSentAt: now },
    })
  })

  test('does not advance the cursor when delivery fails', async () => {
    mocks.buildChangedCsvExports.mockResolvedValue([
      { kind: 'units', filename: 'units.csv', content: 'id\n1', rowCount: 1 },
    ])
    mocks.sendNotification.mockResolvedValue({ ok: false })

    expect(await sendDailyCsvExportToLandlord(user.id, now)).toEqual({
      ok: false,
      skipped: false,
      reason: 'delivery-failed',
    })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  test('skips accounts that were sent less than 24 hours ago', async () => {
    mocks.findUnique.mockResolvedValue({
      ...user,
      dailyCsvExportLastSentAt: new Date('2026-06-10T11:00:00.000Z'),
    })

    expect(await sendDailyCsvExportToLandlord(user.id, now)).toEqual({
      ok: true,
      skipped: true,
      reason: 'not-due',
    })
    expect(mocks.buildChangedCsvExports).not.toHaveBeenCalled()
  })

  test('daily CSV still sends when general email alerts are paused', async () => {
    mocks.findUnique.mockResolvedValue({
      ...user,
      emailNotificationsEnabled: false,
    })
    mocks.buildChangedCsvExports.mockResolvedValue([
      { kind: 'units', filename: 'units.csv', content: 'id\n1', rowCount: 1 },
    ])
    mocks.sendNotification.mockResolvedValue({ ok: true })

    expect(await sendDailyCsvExportToLandlord(user.id, now)).toEqual({ ok: true, skipped: false, files: 1 })
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ to: user.email }),
      { ownerUserId: user.id, transportHint: 'system', bypassUserPreference: true },
    )
  })
})
