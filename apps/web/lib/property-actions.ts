'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { isDatabaseAvailable } from '@/lib/db-status'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { writeAuditLog } from '@/lib/audit-log'
import { logServerActionError } from '@/lib/observability'
import { buildBulkUnitLabels, DEFAULT_APARTMENT_AREAS, type PropertyType } from '@/lib/property-setup'
import { checkUnitCapacity } from '@/lib/account-limits'

export type PropertyActionState = { error: string | null; success?: boolean; message?: string }

async function getSessionUserId(): Promise<string | null> {
  const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())
  return session.isLoggedIn && session.userId ? session.userId : null
}

function readTrimmedString(formData: FormData, key: string) {
  return ((formData.get(key) as string) ?? '').trim()
}

function normalizeConfirmation(value: string) {
  return value.trim()
}

function readOptionalInt(formData: FormData, key: string, label: string, max: number) {
  const raw = readTrimmedString(formData, key)
  if (!raw) return { value: null }
  if (!/^\d+$/.test(raw)) return { error: `${label} must be a whole number.` }
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0 || value > max) return { error: `${label} is outside the allowed range.` }
  return { value }
}

function readOptionalNumber(formData: FormData, key: string, label: string, max: number) {
  const raw = readTrimmedString(formData, key)
  if (!raw) return { value: null }
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > max) return { error: `${label} is outside the allowed range.` }
  return { value: Math.round(value * 10) / 10 }
}

function readOptionalMoneyCents(formData: FormData, key: string, label: string, maxDollars: number) {
  const raw = readTrimmedString(formData, key).replace(/[$,]/g, '')
  if (!raw) return { value: null }
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { error: `${label} must be a valid dollar amount.` }
  const dollars = Number(raw)
  if (!Number.isFinite(dollars) || dollars < 0 || dollars > maxDollars) return { error: `${label} is outside the allowed range.` }
  return { value: Math.round(dollars * 100) }
}

export async function createPropertyAction(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode, no database connected. Creating properties is disabled.' }
  }

  const ownerId = await getSessionUserId()
  if (!ownerId) return { error: 'You must be logged in to create a property.' }

  const name = readTrimmedString(formData, 'name')
  const address = readTrimmedString(formData, 'address')
  const propertyType = (readTrimmedString(formData, 'propertyType') || 'single_family') as PropertyType
  const unitCountRaw = readTrimmedString(formData, 'unitCount')
  const firstUnitNumberRaw = readTrimmedString(formData, 'firstUnitNumber')
  const unitLabelPrefix = readTrimmedString(formData, 'unitLabelPrefix')

  if (!name) return { error: 'Property name is required.' }
  if (!address) return { error: 'Address is required.' }
  if (name.length > 200) return { error: 'Property name must be 200 characters or fewer.' }
  if (address.length > 400) return { error: 'Address must be 400 characters or fewer.' }
  if (!['single_family', 'multifamily', 'cooperative'].includes(propertyType)) return { error: 'Choose a valid property type.' }
  if (propertyType === 'cooperative') {
    const user = await prisma.user.findUnique({ where: { id: ownerId }, select: { subscriptionPlan: true } })
    if (!user?.subscriptionPlan || !['pro', 'portfolio'].includes(user.subscriptionPlan)) return { error: 'Co-op Mode is included with the Pro plan. Choose Pro before adding a cooperative building.' }
  }

  let unitLabels: string[] = []
  if (propertyType === 'multifamily' || propertyType === 'cooperative') {
    try {
      unitLabels = buildBulkUnitLabels(Number(unitCountRaw), Number(firstUnitNumberRaw), unitLabelPrefix)
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Check the apartment unit setup.' }
    }
    const capacity = await checkUnitCapacity(ownerId)
    if (capacity.limit != null && capacity.activeUnits + unitLabels.length > capacity.limit) {
      return { error: `Your subscription has room for ${capacity.limit} active units. Increase the unit allowance in Plan and billing before adding this property.` }
    }
  }

  let propertyId: string
  try {
    const property = await prisma.$transaction(async (tx) => {
      const created = await tx.property.create({ data: { name, address, ownerId, propertyType } })
      if (unitLabels.length) {
        await tx.unit.createMany({
          data: [
            ...unitLabels.map((label) => ({ propertyId: created.id, label, locationType: 'residential' as const })),
            ...DEFAULT_APARTMENT_AREAS.map(([label, areaType]) => ({ propertyId: created.id, label, locationType: 'common_area' as const, areaType })),
          ],
        })
      }
      return created
    })
    propertyId = property.id
    await prisma.productEvent.create({ data: { orgId: ownerId, eventName: 'property_created', metadataJson: JSON.stringify({ propertyId: property.id }) } }).catch(() => null)
    await writeAuditLog({
      orgId: ownerId,
      actorUserId: ownerId,
      entityType: 'property',
      entityId: property.id,
      action: 'property.created',
      summary: `Created property ${name}.`,
      metadata: { address, propertyType, unitsCreated: unitLabels.length, areasCreated: ['multifamily', 'cooperative'].includes(propertyType) ? DEFAULT_APARTMENT_AREAS.length : 0 },
    })
  } catch (error) {
    await logServerActionError('property.create', error, { ownerId })
    return { error: 'Could not create property. Please try again.' }
  }

  revalidatePath('/properties')
  redirect(`/properties/${propertyId}`)
}

export async function updatePropertyAction(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode, no database connected. Editing properties is disabled.' }
  }

  const ownerId = await getSessionUserId()
  if (!ownerId) return { error: 'You must be logged in to edit a property.' }

  const propertyId = readTrimmedString(formData, 'propertyId')
  const name = readTrimmedString(formData, 'name')
  const address = readTrimmedString(formData, 'address')

  if (!propertyId) return { error: 'Property ID is required.' }
  if (!name) return { error: 'Property name is required.' }
  if (!address) return { error: 'Address is required.' }
  if (name.length > 200) return { error: 'Property name must be 200 characters or fewer.' }
  if (address.length > 400) return { error: 'Address must be 400 characters or fewer.' }

  try {
    const updated = await prisma.property.updateMany({
      where: { id: propertyId, ownerId },
      data: { name, address },
    })

    if (updated.count === 0) {
      return { error: 'Property not found or you do not have access.' }
    }

    await writeAuditLog({
      orgId: ownerId,
      actorUserId: ownerId,
      entityType: 'property',
      entityId: propertyId,
      action: 'property.updated',
      summary: `Updated property ${name}.`,
      metadata: { address },
    })
  } catch (error) {
    await logServerActionError('property.update', error, { ownerId, propertyId })
    return { error: 'Could not update property. Please try again.' }
  }

  revalidatePath('/properties')
  revalidatePath(`/properties/${propertyId}`)
  redirect(`/properties/${propertyId}`)
}

export async function archivePropertyAction(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode, no database connected. Archiving properties is disabled.' }
  }

  const ownerId = await getSessionUserId()
  if (!ownerId) return { error: 'You must be logged in to archive a property.' }

  const propertyId = readTrimmedString(formData, 'propertyId')

  if (!propertyId) return { error: 'Property ID is required.' }

  try {
    const updated = await prisma.property.updateMany({
      where: { id: propertyId, ownerId },
      data: { isActive: false },
    })

    if (updated.count === 0) {
      return { error: 'Property not found or you do not have access.' }
    }

    await prisma.unit.updateMany({
      where: { propertyId },
      data: { isActive: false },
    })

    await writeAuditLog({
      orgId: ownerId,
      actorUserId: ownerId,
      entityType: 'property',
      entityId: propertyId,
      action: 'property.archived',
      summary: 'Archived property and inactive-linked its units.',
    })
  } catch (error) {
    await logServerActionError('property.archive', error, { ownerId, propertyId })
    return { error: 'Could not archive property. Please try again.' }
  }

  revalidatePath('/properties')
  revalidatePath(`/properties/${propertyId}`)
  redirect('/properties')
}

export async function restorePropertyAction(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode, no database connected. Restoring properties is disabled.' }
  }

  const ownerId = await getSessionUserId()
  if (!ownerId) return { error: 'You must be logged in to restore a property.' }

  const propertyId = readTrimmedString(formData, 'propertyId')

  if (!propertyId) return { error: 'Property ID is required.' }

  try {
    const updated = await prisma.property.updateMany({
      where: { id: propertyId, ownerId },
      data: { isActive: true },
    })

    if (updated.count === 0) {
      return { error: 'Property not found or you do not have access.' }
    }

    await writeAuditLog({
      orgId: ownerId,
      actorUserId: ownerId,
      entityType: 'property',
      entityId: propertyId,
      action: 'property.restored',
      summary: 'Restored property to active state.',
    })
  } catch (error) {
    await logServerActionError('property.restore', error, { ownerId, propertyId })
    return { error: 'Could not restore property. Please try again.' }
  }

  revalidatePath('/properties')
  revalidatePath(`/properties/${propertyId}`)
  redirect(`/properties/${propertyId}`)
}

export async function deletePropertyAction(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode, no database connected. Deleting properties is disabled.' }
  }

  const ownerId = await getSessionUserId()
  if (!ownerId) return { error: 'You must be logged in to delete a property.' }

  const propertyId = readTrimmedString(formData, 'propertyId')
  const propertyName = readTrimmedString(formData, 'propertyName')
  const confirmation = normalizeConfirmation(readTrimmedString(formData, 'confirmation'))

  if (!propertyId) return { error: 'Property ID is required.' }
  if (!propertyName) return { error: 'Property name is required.' }
  if (confirmation !== propertyName) {
    return { error: 'Type the exact property name to confirm deletion.' }
  }

  try {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ownerId },
      include: {
        _count: {
          select: {
            units: true,
            requests: true,
            tenantIdentities: true,
          },
        },
      },
    })

    if (!property) {
      return { error: 'Property not found or you do not have access.' }
    }

    if (property._count.requests > 0) {
      return { error: 'Cannot delete a property with maintenance history. Keep it for records.' }
    }

    if (property._count.tenantIdentities > 0) {
      return { error: 'Cannot delete a property with tenant identities attached.' }
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          orgId: ownerId,
          actorUserId: ownerId,
          entityType: 'property',
          entityId: propertyId,
          action: 'property.deleted',
          summary: `Deleted property ${propertyName}.`,
        },
      })

      await tx.property.delete({ where: { id: propertyId } })
    })
  } catch (error) {
    await logServerActionError('property.delete', error, { ownerId, propertyId })
    return { error: 'Could not delete property. Please try again.' }
  }

  revalidatePath('/properties')
  redirect('/properties')
}

export async function createUnitAction(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode, no database connected. Creating units is disabled.' }
  }

  const ownerId = await getSessionUserId()
  if (!ownerId) return { error: 'You must be logged in to create a unit.' }

  const propertyId = readTrimmedString(formData, 'propertyId')
  const label = readTrimmedString(formData, 'label')
  const city = readTrimmedString(formData, 'city')
  const state = readTrimmedString(formData, 'state')
  const tenantName = readTrimmedString(formData, 'tenantName')
  const tenantEmail = readTrimmedString(formData, 'tenantEmail').toLowerCase()
  const sizeSqFt = readOptionalInt(formData, 'sizeSqFt', 'Size', 100000)
  const bedrooms = readOptionalInt(formData, 'bedrooms', 'Bedrooms', 100)
  const bathrooms = readOptionalNumber(formData, 'bathrooms', 'Bathrooms', 100)
  const monthlyRentCents = readOptionalMoneyCents(formData, 'monthlyRent', 'Monthly rent', 1000000)

  if (!propertyId) return { error: 'Property ID is required.' }
  if (!label) return { error: 'Unit label is required.' }
  if (label.length > 100) return { error: 'Unit label must be 100 characters or fewer.' }
  if (city.length > 120) return { error: 'City must be 120 characters or fewer.' }
  if (state.length > 80) return { error: 'State must be 80 characters or fewer.' }
  if (tenantName.length > 120) return { error: 'Tenant name must be 120 characters or fewer.' }
  if (tenantEmail.length > 254) return { error: 'Tenant email is too long.' }
  if (sizeSqFt.error) return { error: sizeSqFt.error }
  if (bedrooms.error) return { error: bedrooms.error }
  if (bathrooms.error) return { error: bathrooms.error }
  if (monthlyRentCents.error) return { error: monthlyRentCents.error }

  try {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ownerId },
      select: { id: true },
    })

    if (!property) {
      return { error: 'Property not found or you do not have access.' }
    }

    const capacity = await checkUnitCapacity(ownerId)
    if (!capacity.ok) return { error: `Your subscription has room for ${capacity.limit} active units. Increase the unit allowance in Plan and billing before adding another unit.` }

    const unit = await prisma.unit.create({
      data: {
        propertyId,
        label,
        city: city || null,
        state: state || null,
        tenantName: tenantName || null,
        tenantEmail: tenantEmail || null,
        sizeSqFt: sizeSqFt.value,
        bedrooms: bedrooms.value,
        bathrooms: bathrooms.value,
        monthlyRentCents: monthlyRentCents.value,
      },
    })

    await writeAuditLog({
      orgId: ownerId,
      actorUserId: ownerId,
      entityType: 'unit',
      entityId: unit.id,
      action: 'unit.created',
      summary: `Created unit ${label}.`,
      metadata: { propertyId, city: city || null, state: state || null, sizeSqFt: sizeSqFt.value, bedrooms: bedrooms.value, bathrooms: bathrooms.value, monthlyRentCents: monthlyRentCents.value },
    })
  } catch (error) {
    await logServerActionError('unit.create', error, { ownerId, propertyId })
    return { error: 'Could not create unit. Please try again.' }
  }

  revalidatePath(`/properties/${propertyId}`)
  redirect(`/properties/${propertyId}`)
}

export async function createPropertyAreaAction(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  if (!await isDatabaseAvailable()) return { error: 'Demo mode, no database connected. Creating property areas is disabled.' }
  const ownerId = await getSessionUserId()
  if (!ownerId) return { error: 'You must be logged in to add a property area.' }
  const propertyId = readTrimmedString(formData, 'propertyId')
  const label = readTrimmedString(formData, 'label')
  if (!propertyId) return { error: 'Property ID is required.' }
  if (!label) return { error: 'Area name is required.' }
  if (label.length > 100) return { error: 'Area name must be 100 characters or fewer.' }

  const property = await prisma.property.findFirst({ where: { id: propertyId, ownerId }, select: { id: true } })
  if (!property) return { error: 'Property not found or you do not have access.' }
  const duplicate = await prisma.unit.findFirst({
    where: { propertyId, locationType: 'common_area', label: { equals: label, mode: 'insensitive' } },
    select: { id: true },
  })
  if (duplicate) return { error: 'That property area already exists.' }

  const area = await prisma.unit.create({
    data: { propertyId, label, locationType: 'common_area', areaType: 'custom' },
  }).catch(() => null)
  if (!area) return { error: 'Could not add the property area. Please try again.' }

  await writeAuditLog({
    orgId: ownerId,
    actorUserId: ownerId,
    entityType: 'property',
    entityId: propertyId,
    action: 'property.areaCreated',
    summary: `Added common area ${label}.`,
    metadata: { areaId: area.id },
  })
  revalidatePath(`/properties/${propertyId}`)
  revalidatePath('/submit')
  return { error: null, success: true, message: 'Property area added.' }
}

export async function updateUnitAction(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode, no database connected. Editing units is disabled.' }
  }

  const ownerId = await getSessionUserId()
  if (!ownerId) return { error: 'You must be logged in to edit a unit.' }

  const unitId = readTrimmedString(formData, 'unitId')
  const propertyId = readTrimmedString(formData, 'propertyId')
  const label = readTrimmedString(formData, 'label')
  const city = readTrimmedString(formData, 'city')
  const state = readTrimmedString(formData, 'state')
  const tenantName = readTrimmedString(formData, 'tenantName')
  const tenantEmail = readTrimmedString(formData, 'tenantEmail').toLowerCase()
  const sizeSqFt = readOptionalInt(formData, 'sizeSqFt', 'Size', 100000)
  const bedrooms = readOptionalInt(formData, 'bedrooms', 'Bedrooms', 100)
  const bathrooms = readOptionalNumber(formData, 'bathrooms', 'Bathrooms', 100)
  const monthlyRentCents = readOptionalMoneyCents(formData, 'monthlyRent', 'Monthly rent', 1000000)

  if (!unitId) return { error: 'Unit ID is required.' }
  if (!propertyId) return { error: 'Property ID is required.' }
  if (!label) return { error: 'Unit label is required.' }
  if (label.length > 100) return { error: 'Unit label must be 100 characters or fewer.' }
  if (city.length > 120) return { error: 'City must be 120 characters or fewer.' }
  if (state.length > 80) return { error: 'State must be 80 characters or fewer.' }
  if (tenantName.length > 120) return { error: 'Tenant name must be 120 characters or fewer.' }
  if (tenantEmail.length > 254) return { error: 'Tenant email is too long.' }
  if (sizeSqFt.error) return { error: sizeSqFt.error }
  if (bedrooms.error) return { error: bedrooms.error }
  if (bathrooms.error) return { error: bathrooms.error }
  if (monthlyRentCents.error) return { error: monthlyRentCents.error }

  try {
    const updated = await prisma.unit.updateMany({
      where: { id: unitId, propertyId, property: { ownerId } },
      data: {
        label,
        city: city || null,
        state: state || null,
        tenantName: tenantName || null,
        tenantEmail: tenantEmail || null,
        sizeSqFt: sizeSqFt.value,
        bedrooms: bedrooms.value,
        bathrooms: bathrooms.value,
        monthlyRentCents: monthlyRentCents.value,
      },
    })

    if (updated.count === 0) {
      return { error: 'Unit not found or you do not have access.' }
    }

    await prisma.tenantIdentity.updateMany({
      where: {
        orgId: ownerId,
        propertyId,
        unitId,
        status: { in: ['pending_invite', 'active'] },
      },
      data: {
        ...(tenantName ? { tenantName } : {}),
        email: tenantEmail || null,
      },
    })

    await writeAuditLog({
      orgId: ownerId,
      actorUserId: ownerId,
      entityType: 'unit',
      entityId: unitId,
      action: 'unit.updated',
      summary: `Updated unit ${label}.`,
      metadata: { propertyId, city: city || null, state: state || null, sizeSqFt: sizeSqFt.value, bedrooms: bedrooms.value, bathrooms: bathrooms.value, monthlyRentCents: monthlyRentCents.value },
    })
  } catch (error) {
    await logServerActionError('unit.update', error, { ownerId, propertyId, unitId })
    return { error: 'Could not update unit. Please try again.' }
  }

  revalidatePath('/properties')
  revalidatePath(`/properties/${propertyId}`)
  revalidatePath(`/units/${unitId}`)
  redirect(`/units/${unitId}`)
}

export async function archiveUnitAction(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode, no database connected. Archiving units is disabled.' }
  }

  const ownerId = await getSessionUserId()
  if (!ownerId) return { error: 'You must be logged in to archive a unit.' }

  const unitId = readTrimmedString(formData, 'unitId')
  const propertyId = readTrimmedString(formData, 'propertyId')

  if (!unitId) return { error: 'Unit ID is required.' }
  if (!propertyId) return { error: 'Property ID is required.' }

  try {
    const updated = await prisma.unit.updateMany({
      where: { id: unitId, propertyId, property: { ownerId } },
      data: { isActive: false },
    })

    if (updated.count === 0) {
      return { error: 'Unit not found or you do not have access.' }
    }

    await writeAuditLog({
      orgId: ownerId,
      actorUserId: ownerId,
      entityType: 'unit',
      entityId: unitId,
      action: 'unit.archived',
      summary: 'Archived unit.',
      metadata: { propertyId },
    })
  } catch (error) {
    await logServerActionError('unit.archive', error, { ownerId, propertyId, unitId })
    return { error: 'Could not archive unit. Please try again.' }
  }

  revalidatePath('/properties')
  revalidatePath(`/properties/${propertyId}`)
  revalidatePath(`/units/${unitId}`)
  redirect(`/properties/${propertyId}`)
}

export async function restoreUnitAction(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode, no database connected. Restoring units is disabled.' }
  }

  const ownerId = await getSessionUserId()
  if (!ownerId) return { error: 'You must be logged in to restore a unit.' }

  const unitId = readTrimmedString(formData, 'unitId')
  const propertyId = readTrimmedString(formData, 'propertyId')

  if (!unitId) return { error: 'Unit ID is required.' }
  if (!propertyId) return { error: 'Property ID is required.' }

  try {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ownerId },
      select: { isActive: true },
    })

    if (!property) {
      return { error: 'Property not found or you do not have access.' }
    }

    if (!property.isActive) {
      return { error: 'Restore the property before restoring its units.' }
    }

    const capacity = await checkUnitCapacity(ownerId)
    if (!capacity.ok) return { error: `Your subscription has room for ${capacity.limit} active units. Increase the unit allowance in Plan and billing before restoring another unit.` }

    const updated = await prisma.unit.updateMany({
      where: { id: unitId, propertyId, property: { ownerId } },
      data: { isActive: true },
    })

    if (updated.count === 0) {
      return { error: 'Unit not found or you do not have access.' }
    }

    await writeAuditLog({
      orgId: ownerId,
      actorUserId: ownerId,
      entityType: 'unit',
      entityId: unitId,
      action: 'unit.restored',
      summary: 'Restored unit to active state.',
      metadata: { propertyId },
    })
  } catch (error) {
    await logServerActionError('unit.restore', error, { ownerId, propertyId, unitId })
    return { error: 'Could not restore unit. Please try again.' }
  }

  revalidatePath('/properties')
  revalidatePath(`/properties/${propertyId}`)
  revalidatePath(`/units/${unitId}`)
  redirect(`/units/${unitId}`)
}

export async function deleteUnitAction(
  _prev: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode, no database connected. Deleting units is disabled.' }
  }

  const ownerId = await getSessionUserId()
  if (!ownerId) return { error: 'You must be logged in to delete a unit.' }

  const unitId = readTrimmedString(formData, 'unitId')
  const propertyId = readTrimmedString(formData, 'propertyId')
  const unitLabel = readTrimmedString(formData, 'unitLabel')
  const confirmation = normalizeConfirmation(readTrimmedString(formData, 'confirmation'))

  if (!unitId) return { error: 'Unit ID is required.' }
  if (!propertyId) return { error: 'Property ID is required.' }
  if (!unitLabel) return { error: 'Unit label is required.' }
  if (confirmation !== unitLabel) {
    return { error: 'Type the exact unit label to confirm deletion.' }
  }

  try {
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, propertyId, property: { ownerId } },
      include: {
        _count: {
          select: {
            requests: true,
            tenantIdentities: true,
          },
        },
      },
    })

    if (!unit) {
      return { error: 'Unit not found or you do not have access.' }
    }

    if (unit._count.requests > 0) {
      return { error: 'Cannot delete a unit with maintenance history. Keep it for records.' }
    }

    if (unit._count.tenantIdentities > 0) {
      return { error: 'Cannot delete a unit with tenant identity records attached.' }
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          orgId: ownerId,
          actorUserId: ownerId,
          entityType: 'unit',
          entityId: unitId,
          action: 'unit.deleted',
          summary: `Deleted unit ${unitLabel}.`,
          metadataJson: JSON.stringify({ propertyId }),
        },
      })

      await tx.unit.delete({ where: { id: unitId } })
    })
  } catch (error) {
    await logServerActionError('unit.delete', error, { ownerId, propertyId, unitId })
    return { error: 'Could not delete unit. Please try again.' }
  }

  revalidatePath('/properties')
  revalidatePath(`/properties/${propertyId}`)
  redirect(`/properties/${propertyId}`)
}
