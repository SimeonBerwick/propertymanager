'use server'

import { revalidatePath } from 'next/cache'
import { parseCsv } from '@/lib/csv-tools'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit-log'
import type { RequestStatus, Urgency } from '@prisma/client'

export type OpsCsvState = { error: string | null; success?: string }

function value(row: Record<string, string>, ...names: string[]) {
  for (const name of names) {
    const direct = row[name]
    if (direct) return direct.trim()
    const found = Object.entries(row).find(([key]) => key.toLowerCase() === name.toLowerCase())
    if (found?.[1]) return found[1].trim()
  }
  return ''
}

function optionalInt(raw: string) {
  if (!raw) return null
  const parsed = Number(raw.replace(/,/g, ''))
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function optionalFloat(raw: string) {
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 10) / 10 : null
}

function optionalMoneyCents(raw: string) {
  if (!raw) return null
  const parsed = Number(raw.replace(/[$,]/g, ''))
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null
}

function boolFromCsv(raw: string, fallback = true) {
  if (!raw) return fallback
  return !['false', 'no', '0', 'inactive', 'archived'].includes(raw.toLowerCase())
}

async function csvRows(formData: FormData) {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CSV file.' }
  if (file.size > 1_000_000) return { error: 'CSV must be 1 MB or smaller.' }
  return { rows: parseCsv(await file.text()).slice(0, 1000) }
}

async function findOrCreateProperty(ownerId: string, name: string, address: string) {
  const existing = await prisma.property.findFirst({ where: { ownerId, name }, select: { id: true } })
  if (existing) return existing
  return prisma.property.create({ data: { ownerId, name, address: address || 'Imported property' }, select: { id: true } })
}

export async function importUnitsCsv(_prev: OpsCsvState, formData: FormData): Promise<OpsCsvState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }
  const parsed = await csvRows(formData)
  if (parsed.error) return { error: parsed.error }

  let created = 0
  let updated = 0
  let skipped = 0

  for (const row of parsed.rows ?? []) {
    const propertyName = value(row, 'propertyName', 'property')
    const label = value(row, 'unitLabel', 'label', 'unit')
    if (!propertyName || !label) {
      skipped += 1
      continue
    }
    const property = await findOrCreateProperty(session.userId, propertyName, value(row, 'propertyAddress', 'address'))
    const data = {
      tenantName: value(row, 'tenantName') || null,
      tenantEmail: value(row, 'tenantEmail', 'email').toLowerCase() || null,
      sizeSqFt: optionalInt(value(row, 'sizeSqFt', 'size')),
      bedrooms: optionalInt(value(row, 'bedrooms', 'beds')),
      bathrooms: optionalFloat(value(row, 'bathrooms', 'baths')),
      monthlyRentCents: optionalMoneyCents(value(row, 'monthlyRent', 'rent')),
      isActive: boolFromCsv(value(row, 'isActive', 'active'), true),
    }
    const existing = await prisma.unit.findFirst({ where: { propertyId: property.id, label }, select: { id: true } })
    if (existing) {
      await prisma.unit.update({ where: { id: existing.id }, data })
      updated += 1
    } else {
      await prisma.unit.create({ data: { propertyId: property.id, label, ...data } })
      created += 1
    }
  }

  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'unit', entityId: session.userId, action: 'unit.csvImported', summary: `Imported units CSV: ${created} created, ${updated} updated, ${skipped} skipped.` })
  revalidatePath('/ops')
  revalidatePath('/properties')
  return { error: null, success: `Units imported: ${created} created, ${updated} updated, ${skipped} skipped.` }
}

export async function importVendorsCsv(_prev: OpsCsvState, formData: FormData): Promise<OpsCsvState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }
  const parsed = await csvRows(formData)
  if (parsed.error) return { error: parsed.error }

  let created = 0
  let updated = 0
  let skipped = 0
  for (const row of parsed.rows ?? []) {
    const name = value(row, 'name', 'vendorName')
    if (!name) {
      skipped += 1
      continue
    }
    const email = value(row, 'email', 'vendorEmail').toLowerCase()
    const data = {
      email: email || null,
      phone: value(row, 'phone', 'vendorPhone') || null,
      categoriesCsv: value(row, 'categories', 'category'),
      supportedLanguagesCsv: value(row, 'supportedLanguages', 'languages') || 'english',
      supportedCurrenciesCsv: value(row, 'supportedCurrencies', 'currencies') || 'usd',
      isActive: boolFromCsv(value(row, 'isActive', 'active'), true),
    }
    const existing = await prisma.vendor.findFirst({ where: { orgId: session.userId, OR: [{ name }, ...(email ? [{ email }] : [])] }, select: { id: true } })
    if (existing) {
      await prisma.vendor.update({ where: { id: existing.id }, data: { name, ...data } })
      updated += 1
    } else {
      await prisma.vendor.create({ data: { orgId: session.userId, name, ...data } })
      created += 1
    }
  }

  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'vendor', entityId: session.userId, action: 'vendor.csvImported', summary: `Imported vendors CSV: ${created} created, ${updated} updated, ${skipped} skipped.` })
  revalidatePath('/ops')
  revalidatePath('/vendors')
  return { error: null, success: `Vendors imported: ${created} created, ${updated} updated, ${skipped} skipped.` }
}

function normalizedUrgency(raw: string): Urgency {
  return raw === 'low' || raw === 'high' || raw === 'urgent' ? raw : 'medium'
}

function normalizedStatus(raw: string): RequestStatus {
  const allowed = ['requested', 'approved', 'declined', 'vendor_selected', 'scheduled', 'in_progress', 'completed', 'closed', 'canceled', 'reopened']
  return allowed.includes(raw) ? raw as RequestStatus : 'requested'
}

export async function importTicketsCsv(_prev: OpsCsvState, formData: FormData): Promise<OpsCsvState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }
  const parsed = await csvRows(formData)
  if (parsed.error) return { error: parsed.error }

  let created = 0
  let skipped = 0
  for (const row of parsed.rows ?? []) {
    const propertyName = value(row, 'propertyName', 'property')
    const unitLabel = value(row, 'unitLabel', 'unit')
    const title = value(row, 'title', 'subject')
    const description = value(row, 'description', 'details', 'body')
    if (!propertyName || !unitLabel || !title || !description) {
      skipped += 1
      continue
    }
    const unit = await prisma.unit.findFirst({
      where: { label: unitLabel, property: { ownerId: session.userId, name: propertyName } },
      include: { property: true },
    })
    if (!unit) {
      skipped += 1
      continue
    }
    await prisma.maintenanceRequest.create({
      data: {
        propertyId: unit.propertyId,
        unitId: unit.id,
        orgId: session.userId,
        submittedByName: value(row, 'submittedByName', 'tenantName') || unit.tenantName,
        submittedByEmail: value(row, 'submittedByEmail', 'tenantEmail').toLowerCase() || unit.tenantEmail,
        title,
        description,
        category: value(row, 'category') || 'general',
        urgency: normalizedUrgency(value(row, 'urgency').toLowerCase()),
        status: normalizedStatus(value(row, 'status').toLowerCase()),
        assignedVendorName: value(row, 'assignedVendorName', 'vendorName') || null,
        assignedVendorEmail: value(row, 'assignedVendorEmail', 'vendorEmail').toLowerCase() || null,
        assignedVendorPhone: value(row, 'assignedVendorPhone', 'vendorPhone') || null,
      },
    })
    created += 1
  }

  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'request', entityId: session.userId, action: 'request.csvImported', summary: `Imported tickets CSV: ${created} created, ${skipped} skipped.` })
  revalidatePath('/ops')
  revalidatePath('/dashboard')
  return { error: null, success: `Tickets imported: ${created} created, ${skipped} skipped.` }
}

