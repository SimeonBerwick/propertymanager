'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { writeAuditLog } from '@/lib/audit-log'

export type VendorActionState = { error: string | null; success?: boolean }

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function getCsv(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean).join(',')
}

function getMulti(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is string => typeof value === 'string').map((v) => v.trim()).filter(Boolean)
}

function validateVendorInput(name: string, email: string, phone: string) {
  if (!name) return 'Vendor name is required.'
  if (name.length > 120) return 'Vendor name must be 120 characters or fewer.'
  if (email.length > 254) return 'Vendor email must be 254 characters or fewer.'
  if (phone.length > 40) return 'Vendor phone must be 40 characters or fewer.'
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Vendor email is invalid.'
  return null
}

export async function createVendorAction(
  _prev: VendorActionState,
  formData: FormData,
): Promise<VendorActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  const name = getString(formData, 'name')
  const email = getString(formData, 'email').toLowerCase()
  const phone = getString(formData, 'phone')
  const categories = getMulti(formData, 'categories')
  const supportedLanguages = getMulti(formData, 'supportedLanguages')
  const supportedCurrencies = getMulti(formData, 'supportedCurrencies')
  const isActive = getString(formData, 'isActive') !== 'false'

  const error = validateVendorInput(name, email, phone)
  if (error) return { error }

  try {
    const vendor = await prisma.vendor.create({
      data: {
        orgId: session.userId,
        name,
        email: email || null,
        phone: phone || null,
        categoriesCsv: getCsv(categories),
        supportedLanguagesCsv: getCsv(supportedLanguages),
        supportedCurrenciesCsv: getCsv(supportedCurrencies),
        isActive,
      },
    })

    await writeAuditLog({
      actorUserId: session.userId,
      entityType: 'vendor',
      entityId: vendor.id,
      action: 'vendor.created',
      summary: `Created vendor ${name}.`,
      metadata: { email: email || null, phone: phone || null, isActive, categories, supportedLanguages, supportedCurrencies },
    })
  } catch {
    return { error: 'Could not create vendor.' }
  }

  revalidatePath('/vendors')
  redirect('/vendors')
}

export async function updateVendorAction(
  _prev: VendorActionState,
  formData: FormData,
): Promise<VendorActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }

  const vendorId = getString(formData, 'vendorId')
  const name = getString(formData, 'name')
  const email = getString(formData, 'email').toLowerCase()
  const phone = getString(formData, 'phone')
  const categories = getMulti(formData, 'categories')
  const supportedLanguages = getMulti(formData, 'supportedLanguages')
  const supportedCurrencies = getMulti(formData, 'supportedCurrencies')
  const isActive = getString(formData, 'isActive') !== 'false'

  const error = validateVendorInput(name, email, phone)
  if (error) return { error }

  try {
    await prisma.vendor.update({
      where: { id: vendorId, orgId: session.userId },
      data: {
        name,
        email: email || null,
        phone: phone || null,
        categoriesCsv: getCsv(categories),
        supportedLanguagesCsv: getCsv(supportedLanguages),
        supportedCurrenciesCsv: getCsv(supportedCurrencies),
        isActive,
      },
    })

    await writeAuditLog({
      actorUserId: session.userId,
      entityType: 'vendor',
      entityId: vendorId,
      action: isActive ? 'vendor.updated' : 'vendor.archived',
      summary: isActive ? `Updated vendor ${name}.` : `Archived vendor ${name}.`,
      metadata: { email: email || null, phone: phone || null, isActive, categories, supportedLanguages, supportedCurrencies },
    })
  } catch {
    return { error: 'Could not update vendor.' }
  }

  revalidatePath('/vendors')
  revalidatePath(`/vendors/${vendorId}`)
  redirect('/vendors')
}
