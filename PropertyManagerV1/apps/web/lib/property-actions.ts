'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { isDatabaseAvailable } from '@/lib/db-status'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { writeAuditLog } from '@/lib/audit-log'

export type PropertyActionState = { error: string | null }

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

  if (!name) return { error: 'Property name is required.' }
  if (!address) return { error: 'Address is required.' }
  if (name.length > 200) return { error: 'Property name must be 200 characters or fewer.' }
  if (address.length > 400) return { error: 'Address must be 400 characters or fewer.' }

  let propertyId: string
  try {
    const property = await prisma.property.create({ data: { name, address, ownerId } })
    propertyId = property.id
    await writeAuditLog({
      orgId: ownerId,
      actorUserId: ownerId,
      entityType: 'property',
      entityId: property.id,
      action: 'property.created',
      summary: `Created property ${name}.`,
      metadata: { address },
    })
  } catch {
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
  } catch {
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
  } catch {
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
  } catch {
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

    await writeAuditLog({
      orgId: ownerId,
      actorUserId: ownerId,
      entityType: 'property',
      entityId: propertyId,
      action: 'property.deleted',
      summary: `Deleted property ${propertyName}.`,
    })

    await prisma.property.delete({ where: { id: propertyId } })
  } catch {
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
  const tenantName = readTrimmedString(formData, 'tenantName')
  const tenantEmail = readTrimmedString(formData, 'tenantEmail').toLowerCase()

  if (!propertyId) return { error: 'Property ID is required.' }
  if (!label) return { error: 'Unit label is required.' }
  if (label.length > 100) return { error: 'Unit label must be 100 characters or fewer.' }
  if (tenantName.length > 120) return { error: 'Tenant name must be 120 characters or fewer.' }
  if (tenantEmail.length > 254) return { error: 'Tenant email is too long.' }

  try {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, ownerId },
      select: { id: true },
    })

    if (!property) {
      return { error: 'Property not found or you do not have access.' }
    }

    const unit = await prisma.unit.create({
      data: {
        propertyId,
        label,
        tenantName: tenantName || null,
        tenantEmail: tenantEmail || null,
      },
    })

    await writeAuditLog({
      orgId: ownerId,
      actorUserId: ownerId,
      entityType: 'unit',
      entityId: unit.id,
      action: 'unit.created',
      summary: `Created unit ${label}.`,
      metadata: { propertyId },
    })
  } catch {
    return { error: 'Could not create unit. Please try again.' }
  }

  revalidatePath(`/properties/${propertyId}`)
  redirect(`/properties/${propertyId}`)
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
  const tenantName = readTrimmedString(formData, 'tenantName')
  const tenantEmail = readTrimmedString(formData, 'tenantEmail').toLowerCase()

  if (!unitId) return { error: 'Unit ID is required.' }
  if (!propertyId) return { error: 'Property ID is required.' }
  if (!label) return { error: 'Unit label is required.' }
  if (label.length > 100) return { error: 'Unit label must be 100 characters or fewer.' }
  if (tenantName.length > 120) return { error: 'Tenant name must be 120 characters or fewer.' }
  if (tenantEmail.length > 254) return { error: 'Tenant email is too long.' }

  try {
    const updated = await prisma.unit.updateMany({
      where: { id: unitId, propertyId, property: { ownerId } },
      data: {
        label,
        tenantName: tenantName || null,
        tenantEmail: tenantEmail || null,
      },
    })

    if (updated.count === 0) {
      return { error: 'Unit not found or you do not have access.' }
    }

    await writeAuditLog({
      orgId: ownerId,
      actorUserId: ownerId,
      entityType: 'unit',
      entityId: unitId,
      action: 'unit.updated',
      summary: `Updated unit ${label}.`,
      metadata: { propertyId },
    })
  } catch {
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
  } catch {
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
  } catch {
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

    await writeAuditLog({
      orgId: ownerId,
      actorUserId: ownerId,
      entityType: 'unit',
      entityId: unitId,
      action: 'unit.deleted',
      summary: `Deleted unit ${unitLabel}.`,
      metadata: { propertyId },
    })

    await prisma.unit.delete({ where: { id: unitId } })
  } catch {
    return { error: 'Could not delete unit. Please try again.' }
  }

  revalidatePath('/properties')
  revalidatePath(`/properties/${propertyId}`)
  redirect(`/properties/${propertyId}`)
}
