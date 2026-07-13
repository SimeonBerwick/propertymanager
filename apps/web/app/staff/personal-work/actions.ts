'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { REQUEST_CATEGORIES } from '@/lib/maintenance-options'

const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim()
const cents = (value: string) => Math.round(Number(value) * 100)
const categories = (data: FormData) => data.getAll('categories').map(String).filter((value) => REQUEST_CATEGORIES.includes(value as never))

export async function savePersonalWorkDefaultsAction(formData: FormData) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const hourlyRateCents = cents(text(formData, 'hourlyRate'))
  const minimumMinutes = Number(text(formData, 'minimumMinutes'))
  const allowed = categories(formData)
  if (!Number.isInteger(hourlyRateCents) || hourlyRateCents < 0 || hourlyRateCents > 100_000_00) redirect('/staff/personal-work?error=Enter%20a%20valid%20hourly%20rate')
  if (!Number.isInteger(minimumMinutes) || minimumMinutes < 0 || minimumMinutes > 480) redirect('/staff/personal-work?error=Enter%20a%20valid%20minimum')
  if (formData.get('enabled') && !allowed.length) redirect('/staff/personal-work?error=Choose%20at%20least%20one%20category')
  await prisma.user.update({ where: { id: session.userId }, data: { personalWorkEnabled: Boolean(formData.get('enabled')), personalWorkHourlyRateCents: hourlyRateCents, personalWorkMinimumMinutes: minimumMinutes, personalWorkAllowedCategoriesCsv: allowed.join(',') } })
  revalidatePath('/staff/personal-work')
  redirect('/staff/personal-work?saved=1')
}

export async function savePropertyPersonalWorkAction(formData: FormData) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const propertyId = text(formData, 'propertyId')
  const property = await prisma.property.findFirst({ where: { id: propertyId, ownerId: session.userId } })
  if (!property) redirect('/staff/personal-work?error=Property%20not%20found')
  const rate = text(formData, 'hourlyRate')
  const minimum = text(formData, 'minimumMinutes')
  const hourlyRateCents = rate ? cents(rate) : null
  const minimumMinutes = minimum ? Number(minimum) : null
  if (hourlyRateCents !== null && (!Number.isInteger(hourlyRateCents) || hourlyRateCents < 0 || hourlyRateCents > 100_000_00)) redirect('/staff/personal-work?error=Enter%20a%20valid%20property%20rate')
  if (minimumMinutes !== null && (!Number.isInteger(minimumMinutes) || minimumMinutes < 0 || minimumMinutes > 480)) redirect('/staff/personal-work?error=Enter%20a%20valid%20property%20minimum')
  await prisma.property.update({ where: { id: property.id }, data: { personalWorkAllowed: Boolean(formData.get('allowed')), personalWorkHourlyRateCents: hourlyRateCents, personalWorkMinimumMinutes: minimumMinutes, personalWorkAllowedCategoriesCsv: categories(formData).join(',') } })
  revalidatePath('/staff/personal-work')
  redirect('/staff/personal-work?saved=1')
}
