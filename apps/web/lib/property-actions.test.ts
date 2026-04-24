import { beforeEach, describe, expect, test, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  archivePropertyAction,
  createPropertyAction,
  createUnitAction,
  deletePropertyAction,
  deleteUnitAction,
  restoreUnitAction,
  updatePropertyAction,
  updateUnitAction,
} from '@/lib/property-actions'
import {
  createMaintenanceRequest,
  createProperty,
  createTenantIdentity,
  createUnit,
  scaffoldLandlord,
} from '@/test/helpers'

vi.mock('@/lib/db-status', () => ({
  isDatabaseAvailable: vi.fn().mockResolvedValue(true),
}))

vi.mock('iron-session', () => ({
  getIronSession: vi.fn(),
}))

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import { getIronSession } from 'iron-session'

const PREV = { error: null }

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.append(key, value)
  return fd
}

function fakeSession(userId?: string | null) {
  return {
    isLoggedIn: Boolean(userId),
    userId: userId ?? null,
  } as never
}

describe('property-actions', () => {
  beforeEach(() => {
    vi.mocked(getIronSession).mockResolvedValue(fakeSession(null))
  })

  test('createPropertyAction requires authentication', async () => {
    const result = await createPropertyAction(PREV, formData({ name: 'Test', address: '1 Main St' }))
    expect(result.error).toMatch(/logged in/i)
  })

  test('createPropertyAction creates a property and redirects', async () => {
    const { user } = await scaffoldLandlord()
    vi.mocked(getIronSession).mockResolvedValue(fakeSession(user.id))

    await expect(
      createPropertyAction(PREV, formData({ name: 'Desert Villas', address: '123 Cactus Rd' })),
    ).rejects.toThrow(/NEXT_REDIRECT:\/properties\//)

    const property = await prisma.property.findFirst({ where: { ownerId: user.id, name: 'Desert Villas' } })
    expect(property?.address).toBe('123 Cactus Rd')
  })

  test('updatePropertyAction blocks cross-owner edits', async () => {
    const { property } = await scaffoldLandlord()
    const other = await scaffoldLandlord()
    vi.mocked(getIronSession).mockResolvedValue(fakeSession(other.user.id))

    const result = await updatePropertyAction(
      PREV,
      formData({ propertyId: property.id, name: 'Nope', address: 'Nope' }),
    )

    expect(result.error).toBeTruthy()
  })

  test('archivePropertyAction archives the property and all of its units', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    const secondUnit = await createUnit(property.id)
    vi.mocked(getIronSession).mockResolvedValue(fakeSession(user.id))

    await expect(
      archivePropertyAction(PREV, formData({ propertyId: property.id })),
    ).rejects.toThrow(/NEXT_REDIRECT:\/properties/)

    const updatedProperty = await prisma.property.findUnique({ where: { id: property.id } })
    const updatedUnits = await prisma.unit.findMany({ where: { id: { in: [unit.id, secondUnit.id] } } })

    expect(updatedProperty?.isActive).toBe(false)
    expect(updatedUnits.every((record) => record.isActive === false)).toBe(true)
  })

  test('deletePropertyAction refuses properties with maintenance history', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getIronSession).mockResolvedValue(fakeSession(user.id))
    await createMaintenanceRequest(property.id, unit.id)

    const result = await deletePropertyAction(
      PREV,
      formData({ propertyId: property.id, propertyName: property.name, confirmation: property.name }),
    )

    expect(result.error).toMatch(/maintenance history/i)
  })

  test('deletePropertyAction deletes an empty property when confirmation matches', async () => {
    const { user } = await scaffoldLandlord()
    const property = await createProperty(user.id, { name: 'Delete Me' })
    vi.mocked(getIronSession).mockResolvedValue(fakeSession(user.id))

    await expect(
      deletePropertyAction(
        PREV,
        formData({ propertyId: property.id, propertyName: 'Delete Me', confirmation: 'Delete Me' }),
      ),
    ).rejects.toThrow(/NEXT_REDIRECT:\/properties/)

    const deleted = await prisma.property.findUnique({ where: { id: property.id } })
    expect(deleted).toBeNull()
  })

  test('createUnitAction creates a unit under the owner property', async () => {
    const { user, property } = await scaffoldLandlord()
    vi.mocked(getIronSession).mockResolvedValue(fakeSession(user.id))

    await expect(
      createUnitAction(
        PREV,
        formData({
          propertyId: property.id,
          label: 'Unit Z',
          tenantName: 'Taylor Reed',
          tenantEmail: 'TAYLOR@EXAMPLE.COM',
        }),
      ),
    ).rejects.toThrow(new RegExp(`NEXT_REDIRECT:/properties/${property.id}`))

    const unit = await prisma.unit.findFirst({ where: { propertyId: property.id, label: 'Unit Z' } })
    expect(unit?.tenantEmail).toBe('taylor@example.com')
  })

  test('updateUnitAction updates unit fields and clears optional tenant data when blank', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getIronSession).mockResolvedValue(fakeSession(user.id))

    await expect(
      updateUnitAction(
        PREV,
        formData({
          unitId: unit.id,
          propertyId: property.id,
          label: 'Unit AA',
          tenantName: '',
          tenantEmail: '',
        }),
      ),
    ).rejects.toThrow(new RegExp(`NEXT_REDIRECT:/units/${unit.id}`))

    const updated = await prisma.unit.findUnique({ where: { id: unit.id } })
    expect(updated?.label).toBe('Unit AA')
    expect(updated?.tenantName).toBeNull()
    expect(updated?.tenantEmail).toBeNull()
  })

  test('restoreUnitAction refuses to restore a unit while the property is archived', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getIronSession).mockResolvedValue(fakeSession(user.id))
    await prisma.property.update({ where: { id: property.id }, data: { isActive: false } })
    await prisma.unit.update({ where: { id: unit.id }, data: { isActive: false } })

    const result = await restoreUnitAction(
      PREV,
      formData({ unitId: unit.id, propertyId: property.id }),
    )

    expect(result.error).toMatch(/restore the property/i)
  })

  test('deleteUnitAction refuses units with tenant identity records', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getIronSession).mockResolvedValue(fakeSession(user.id))
    await createTenantIdentity(user.id, property.id, unit.id)

    const result = await deleteUnitAction(
      PREV,
      formData({
        unitId: unit.id,
        propertyId: property.id,
        unitLabel: unit.label,
        confirmation: unit.label,
      }),
    )

    expect(result.error).toMatch(/tenant identity/i)
  })

  test('deleteUnitAction deletes an empty unit when confirmation matches', async () => {
    const { user, property } = await scaffoldLandlord()
    const unit = await createUnit(property.id, { label: 'Unit Delete' })
    vi.mocked(getIronSession).mockResolvedValue(fakeSession(user.id))

    await expect(
      deleteUnitAction(
        PREV,
        formData({
          unitId: unit.id,
          propertyId: property.id,
          unitLabel: 'Unit Delete',
          confirmation: 'Unit Delete',
        }),
      ),
    ).rejects.toThrow(new RegExp(`NEXT_REDIRECT:/properties/${property.id}`))

    const deleted = await prisma.unit.findUnique({ where: { id: unit.id } })
    expect(deleted).toBeNull()
  })
})
