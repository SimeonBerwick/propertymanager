'use server'

import { revalidatePath } from 'next/cache'
import { parseCsv } from '@/lib/csv-tools'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit-log'
import type { RequestStatus, Urgency } from '@prisma/client'
import { sendNotification } from '@/lib/notify'
import { sendDailyCsvExportToLandlord } from '@/lib/daily-csv-export'
import { sendMobileInviteAction } from '@/app/operator/mobile-identity/actions'

export type OpsCsvState = { error: string | null; success?: string }

export async function sendSystemEmailTestAction(_prev: OpsCsvState, _formData: FormData): Promise<OpsCsvState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  })
  if (!user?.email) return { error: 'No account email is available for the test.' }

  const result = await sendNotification({
    to: user.email,
    subject: '[Simeonware] Email delivery test',
    text: [
      'This is a test from the app-owned Simeonware email sender.',
      '',
      'If you received this, login security alerts, daily CSV exports, and app notifications can reach this mailbox.',
    ].join('\n'),
  }, { ownerUserId: session.userId, transportHint: 'system', bypassUserPreference: true })

  await writeAuditLog({
    orgId: session.userId,
    actorUserId: session.userId,
    entityType: 'user',
    entityId: session.userId,
    action: result.ok ? 'email.systemTestSent' : 'email.systemTestFailed',
    summary: result.ok ? 'Sent system email delivery test.' : 'System email delivery test failed.',
  })

  return result.ok
    ? { error: null, success: `Test email sent to ${user.email}.` }
    : { error: 'Test email was not delivered. Check NOTIFY_TRANSPORT=smtp, SMTP_URL, and NOTIFY_FROM in the hosted environment.' }
}

export async function sendDailyCsvExportNowAction(_prev: OpsCsvState, _formData: FormData): Promise<OpsCsvState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const result = await sendDailyCsvExportToLandlord(session.userId, new Date(), { force: true })
  revalidatePath('/ops')
  revalidatePath('/dashboard')

  if (result.ok && result.skipped && result.reason === 'no-changes') return { error: null, success: 'CSV delivery checked. No changed rows were found.' }
  if (result.ok && result.skipped) return { error: null, success: 'CSV delivery checked.' }
  if (result.ok) return { error: null, success: `CSV delivery sent with ${result.files ?? 0} attachment${result.files === 1 ? '' : 's'}.` }

  return { error: result.reason === 'disabled' ? 'Daily CSV export is disabled or the account email is missing.' : 'CSV delivery failed. Check system email delivery.' }
}

export async function resendTenantInviteFromOpsAction(_prev: OpsCsvState, formData: FormData): Promise<OpsCsvState> {
  const result = await sendMobileInviteAction({ error: null }, formData)
  revalidatePath('/ops')
  revalidatePath('/dashboard')

  if (result.error) return { error: result.error }
  if (result.deliveryWarning) return { error: null, success: result.deliveryWarning }
  return { error: null, success: result.inviteLink ? 'Tenant invite sent.' : 'Tenant invite created.' }
}

export async function updateVendorEmailFromOpsAction(_prev: OpsCsvState, formData: FormData): Promise<OpsCsvState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }

  const vendorId = String(formData.get('vendorId') ?? '')
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!vendorId) return { error: 'Vendor is missing.' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter a valid vendor email.' }

  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, orgId: session.userId }, select: { id: true, name: true } })
  if (!vendor) return { error: 'Vendor not found.' }

  await prisma.vendor.update({ where: { id: vendor.id }, data: { email } })
  await writeAuditLog({
    orgId: session.userId,
    actorUserId: session.userId,
    entityType: 'vendor',
    entityId: vendor.id,
    action: 'vendor.emailUpdated',
    summary: `Updated email for ${vendor.name}.`,
  })
  revalidatePath('/ops')
  revalidatePath('/access')
  revalidatePath(`/vendors/${vendor.id}`)
  return { error: null, success: `Vendor email updated to ${email}.` }
}

export async function toggleDailyCsvExportAction(formData: FormData) {
  const session = await getLandlordSession()
  if (!session) return

  const enabled = formData.get('enabled') === 'true'
  await prisma.user.update({
    where: { id: session.userId },
    data: {
      dailyCsvExportEnabled: enabled,
      ...(enabled ? { dailyCsvExportLastSentAt: new Date() } : {}),
    },
  })
  await writeAuditLog({
    orgId: session.userId,
    actorUserId: session.userId,
    entityType: 'user',
    entityId: session.userId,
    action: enabled ? 'csv.dailyExportEnabled' : 'csv.dailyExportDisabled',
    summary: `Daily CSV export emails ${enabled ? 'enabled' : 'disabled'}.`,
  })
  revalidatePath('/ops')
}

function isPreview(formData: FormData) {
  return formData.get('preview') === 'true'
}

function staleExport(row: Record<string, string>, updatedAt: Date) {
  const raw = value(row, 'updatedAt')
  if (!raw) return false
  const exportedAt = new Date(raw)
  return !Number.isNaN(exportedAt.getTime()) && updatedAt.getTime() > exportedAt.getTime() + 1000
}

function importSummary(kind: string, preview: boolean, created: number, updated: number, skipped: number, conflicts: number, errors: string[]) {
  const prefix = preview ? `${kind} preview` : `${kind} imported`
  const detail = `${prefix}: ${created} to create, ${updated} to update, ${conflicts} conflicts, ${skipped} skipped.`
  return errors.length ? `${detail} ${errors.slice(0, 5).join(' ')}` : detail
}

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
  if (!session) return { error: 'Sign in again to continue.' }
  const parsed = await csvRows(formData)
  if (parsed.error) return { error: parsed.error }

  let created = 0
  let updated = 0
  let skipped = 0
  let conflicts = 0
  const errors: string[] = []
  const preview = isPreview(formData)

  for (const [index, row] of (parsed.rows ?? []).entries()) {
    const rowNumber = index + 2
    const id = value(row, 'id')
    const propertyName = value(row, 'propertyName', 'property')
    const label = value(row, 'unitLabel', 'label', 'unit')
    if (!propertyName || !label) {
      skipped += 1
      errors.push(`Row ${rowNumber}: property and unit label are required.`)
      continue
    }
    const existingById = id ? await prisma.unit.findFirst({
      where: { id, property: { ownerId: session.userId } },
      select: { id: true, updatedAt: true, propertyId: true },
    }) : null
    if (id && !existingById) {
      skipped += 1
      errors.push(`Row ${rowNumber}: unit ID is not owned by this account.`)
      continue
    }
    if (existingById && staleExport(row, existingById.updatedAt)) {
      conflicts += 1
      errors.push(`Row ${rowNumber}: unit changed after this CSV was downloaded.`)
      continue
    }
    const propertyId = value(row, 'propertyId')
    const existingProperty = propertyId
      ? await prisma.property.findFirst({ where: { id: propertyId, ownerId: session.userId }, select: { id: true } })
      : await prisma.property.findFirst({ where: { ownerId: session.userId, name: propertyName }, select: { id: true } })
    const property = existingProperty ?? (preview ? null : await findOrCreateProperty(session.userId, propertyName, value(row, 'propertyAddress', 'address')))
    const data = {
      label,
      city: value(row, 'city') || null,
      state: value(row, 'state') || null,
      tenantName: value(row, 'tenantName') || null,
      tenantEmail: value(row, 'tenantEmail', 'email').toLowerCase() || null,
      sizeSqFt: optionalInt(value(row, 'sizeSqFt', 'size')),
      bedrooms: optionalInt(value(row, 'bedrooms', 'beds')),
      bathrooms: optionalFloat(value(row, 'bathrooms', 'baths')),
      monthlyRentCents: optionalMoneyCents(value(row, 'monthlyRent', 'rent')),
      isActive: boolFromCsv(value(row, 'isActive', 'active'), true),
    }
    const existing = existingById ?? (property ? await prisma.unit.findFirst({ where: { propertyId: property.id, label }, select: { id: true, updatedAt: true, propertyId: true } }) : null)
    if (existing) {
      if (!preview) await prisma.unit.update({ where: { id: existing.id }, data: { ...data, ...(property ? { propertyId: property.id } : {}) } })
      updated += 1
    } else {
      if (!preview && property) await prisma.unit.create({ data: { propertyId: property.id, ...data } })
      created += 1
    }
  }

  if (preview) return { error: null, success: importSummary('Units', true, created, updated, skipped, conflicts, errors) }
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'unit', entityId: session.userId, action: 'unit.csvImported', summary: `Imported units CSV: ${created} created, ${updated} updated, ${conflicts} conflicts, ${skipped} skipped.` })
  revalidatePath('/ops')
  revalidatePath('/properties')
  return { error: null, success: importSummary('Units', false, created, updated, skipped, conflicts, errors) }
}

export async function importVendorsCsv(_prev: OpsCsvState, formData: FormData): Promise<OpsCsvState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in again to continue.' }
  const parsed = await csvRows(formData)
  if (parsed.error) return { error: parsed.error }

  let created = 0
  let updated = 0
  let skipped = 0
  let conflicts = 0
  const errors: string[] = []
  const preview = isPreview(formData)
  for (const [index, row] of (parsed.rows ?? []).entries()) {
    const rowNumber = index + 2
    const id = value(row, 'id')
    const name = value(row, 'name', 'vendorName')
    if (!name) {
      skipped += 1
      errors.push(`Row ${rowNumber}: vendor name is required.`)
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
    const existing = id
      ? await prisma.vendor.findFirst({ where: { id, orgId: session.userId }, select: { id: true, updatedAt: true } })
      : await prisma.vendor.findFirst({ where: { orgId: session.userId, OR: [{ name }, ...(email ? [{ email }] : [])] }, select: { id: true, updatedAt: true } })
    if (id && !existing) {
      skipped += 1
      errors.push(`Row ${rowNumber}: vendor ID is not owned by this account.`)
      continue
    }
    if (existing && staleExport(row, existing.updatedAt)) {
      conflicts += 1
      errors.push(`Row ${rowNumber}: vendor changed after this CSV was downloaded.`)
      continue
    }
    if (existing) {
      if (!preview) await prisma.vendor.update({ where: { id: existing.id }, data: { name, ...data } })
      updated += 1
    } else {
      if (!preview) await prisma.vendor.create({ data: { orgId: session.userId, name, ...data } })
      created += 1
    }
  }

  if (preview) return { error: null, success: importSummary('Vendors', true, created, updated, skipped, conflicts, errors) }
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'vendor', entityId: session.userId, action: 'vendor.csvImported', summary: `Imported vendors CSV: ${created} created, ${updated} updated, ${conflicts} conflicts, ${skipped} skipped.` })
  revalidatePath('/ops')
  revalidatePath('/vendors')
  return { error: null, success: importSummary('Vendors', false, created, updated, skipped, conflicts, errors) }
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
  if (!session) return { error: 'Sign in again to continue.' }
  const parsed = await csvRows(formData)
  if (parsed.error) return { error: parsed.error }

  let created = 0
  let updated = 0
  let skipped = 0
  let conflicts = 0
  const errors: string[] = []
  const preview = isPreview(formData)
  for (const [index, row] of (parsed.rows ?? []).entries()) {
    const rowNumber = index + 2
    const id = value(row, 'id')
    const propertyName = value(row, 'propertyName', 'property')
    const unitLabel = value(row, 'unitLabel', 'unit')
    const title = value(row, 'title', 'subject')
    const description = value(row, 'description', 'details', 'body')
    if (!propertyName || !unitLabel || !title || !description) {
      skipped += 1
      errors.push(`Row ${rowNumber}: property, unit, title, and description are required.`)
      continue
    }
    const unitId = value(row, 'unitId')
    const unit = await prisma.unit.findFirst({
      where: unitId
        ? { id: unitId, property: { ownerId: session.userId } }
        : { label: unitLabel, property: { ownerId: session.userId, name: propertyName } },
      include: { property: true },
    })
    if (!unit) {
      skipped += 1
      errors.push(`Row ${rowNumber}: matching unit was not found.`)
      continue
    }
    const existing = id ? await prisma.maintenanceRequest.findFirst({
      where: { id, property: { ownerId: session.userId } },
      select: { id: true, updatedAt: true },
    }) : null
    if (id && !existing) {
      skipped += 1
      errors.push(`Row ${rowNumber}: ticket ID is not owned by this account.`)
      continue
    }
    if (existing && staleExport(row, existing.updatedAt)) {
      conflicts += 1
      errors.push(`Row ${rowNumber}: ticket changed after this CSV was downloaded.`)
      continue
    }
    const data = {
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
    }
    if (existing) {
      if (!preview) await prisma.maintenanceRequest.update({ where: { id: existing.id }, data })
      updated += 1
    } else {
      if (!preview) await prisma.maintenanceRequest.create({ data })
      created += 1
    }
  }

  if (preview) return { error: null, success: importSummary('Tickets', true, created, updated, skipped, conflicts, errors) }
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'request', entityId: session.userId, action: 'request.csvImported', summary: `Imported tickets CSV: ${created} created, ${updated} updated, ${conflicts} conflicts, ${skipped} skipped.` })
  revalidatePath('/ops')
  revalidatePath('/dashboard')
  return { error: null, success: importSummary('Tickets', false, created, updated, skipped, conflicts, errors) }
}
