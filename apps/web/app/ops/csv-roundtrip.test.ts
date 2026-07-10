import { describe, expect, test, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { buildCsvExport } from '@/lib/csv-export'
import { parseCsv } from '@/lib/csv-tools'
import { importTicketsCsv, importUnitsCsv, importVendorsCsv } from './actions'
import { createMaintenanceRequest, scaffoldLandlord } from '@/test/helpers'

vi.mock('@/lib/landlord-session')

function upload(content: string) {
  const formData = new FormData()
  formData.set('file', new File([content], 'round-trip.csv', { type: 'text/csv' }))
  return formData
}

describe('CSV download and upload round trips', () => {
  test('preserves supported unit, vendor, and ticket fields', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue({ userId: user.id, isLoggedIn: true } as never)

    await prisma.unit.update({
      where: { id: unit.id },
      data: {
        city: 'Phoenix',
        state: 'AZ',
        tenantName: 'Casey Tenant',
        tenantEmail: 'casey@example.com',
        monthlyRentCents: 185050,
      },
    })
    const vendor = await prisma.vendor.create({
      data: {
        orgId: user.id,
        name: 'Round Trip Repairs',
        email: 'roundtrip@example.com',
        categoriesCsv: 'plumbing,electrical',
        supportedLanguagesCsv: 'english,spanish',
        supportedCurrenciesCsv: 'usd,cad',
      },
    })
    const request = await createMaintenanceRequest(property.id, unit.id, {
      orgId: user.id,
      title: 'CSV round trip request',
      description: 'Quoted text, commas, and\na second line',
      submittedByName: 'Casey Tenant',
      submittedByEmail: 'casey@example.com',
    })

    const units = await buildCsvExport(user.id, 'units')
    const vendors = await buildCsvExport(user.id, 'vendors')
    const tickets = await buildCsvExport(user.id, 'tickets')

    expect(parseCsv(units.content).find((row) => row.id === unit.id)).toMatchObject({ city: 'Phoenix', state: 'AZ', monthlyRent: '1850.50' })
    expect(parseCsv(vendors.content).find((row) => row.id === vendor.id)).toMatchObject({ supportedCurrencies: 'usd,cad' })
    expect(parseCsv(tickets.content).find((row) => row.id === request.id)?.description).toBe('Quoted text, commas, and\na second line')

    await expect(importUnitsCsv({ error: null }, upload(units.content))).resolves.toMatchObject({ error: null })
    await expect(importVendorsCsv({ error: null }, upload(vendors.content))).resolves.toMatchObject({ error: null })
    await expect(importTicketsCsv({ error: null }, upload(tickets.content))).resolves.toMatchObject({ error: null })

    const [savedUnit, savedVendor, savedRequest] = await Promise.all([
      prisma.unit.findUnique({ where: { id: unit.id } }),
      prisma.vendor.findUnique({ where: { id: vendor.id } }),
      prisma.maintenanceRequest.findUnique({ where: { id: request.id } }),
    ])
    expect(savedUnit).toMatchObject({ city: 'Phoenix', state: 'AZ', monthlyRentCents: 185050 })
    expect(savedVendor?.supportedCurrenciesCsv).toBe('usd,cad')
    expect(savedRequest?.description).toBe('Quoted text, commas, and\na second line')
  })
})
