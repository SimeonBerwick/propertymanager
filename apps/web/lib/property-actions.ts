'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { isDatabaseAvailable } from '@/lib/db-status'
import { getSessionOptions, type SessionData } from '@/lib/session'

export type PropertyActionState = { error: string | null }

async function getSessionUserId(): Promise<string | null> {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())
  return session.isLoggedIn && session.userId ? session.userId : null
}

export async function createPropertyAction(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode — no database connected. Creating properties is disabled.' }
  }

  const ownerId = await getSessionUserId()
  if (!ownerId) return { error: 'You must be logged in to create a property.' }

  const name = ((formData.get('name') as string) ?? '').trim()
  const address = ((formData.get('address') as string) ?? '').trim()

  if (!name) return { error: 'Property name is required.' }
  if (!address) return { error: 'Address is required.' }
  if (name.length > 200) return { error: 'Property name must be 200 characters or fewer.' }
  if (address.length > 400) return { error: 'Address must be 400 characters or fewer.' }

  let propertyId: string
  try {
    const property = await prisma.property.create({ data: { name, address, ownerId } })
    propertyId = property.id
  } catch {
    return { error: 'Could not create property. Please try again.' }
  }

  revalidatePath('/properties')
  redirect(`/properties/${propertyId}`)
}

export async function createUnitAction(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode — no database connected. Creating units is disabled.' }
  }

  const propertyId = ((formData.get('propertyId') as string) ?? '').trim()
  const label = ((formData.get('label') as string) ?? '').trim()
  const tenantName = ((formData.get('tenantName') as string) ?? '').trim()
  const tenantEmail = ((formData.get('tenantEmail') as string) ?? '').trim().toLowerCase()

  if (!propertyId) return { error: 'Property ID is required.' }
  if (!label) return { error: 'Unit label is required.' }
  if (label.length > 100) return { error: 'Unit label must be 100 characters or fewer.' }
  if (tenantName.length > 120) return { error: 'Tenant name must be 120 characters or fewer.' }
  if (tenantEmail.length > 254) return { error: 'Tenant email is too long.' }

  try {
    await prisma.unit.create({
      data: {
        propertyId,
        label,
        tenantName: tenantName || null,
        tenantEmail: tenantEmail || null,
      },
    })
  } catch {
    return { error: 'Could not create unit. Please try again.' }
  }

  revalidatePath(`/properties/${propertyId}`)
  redirect(`/properties/${propertyId}`)
}
