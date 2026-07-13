'use server'

import type { Route } from 'next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { decodeInspectionChecklist, parseInspectionChecklist } from '@/lib/inspection-templates'
import { savePhotos, validatePhotoFiles } from '@/lib/photo-upload'
import { writeAuditLog } from '@/lib/audit-log'
import { syncOutlookCalendarForUser } from '@/lib/outlook-calendar-sync'

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim()
}

function dateValue(raw: string) {
  if (!raw) return null
  const parsed = new Date(`${raw}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}` as Route)
}

async function manager() {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  return session
}

export async function createInspectionAction(formData: FormData) {
  const session = await manager()
  const unitId = value(formData, 'unitId')
  const templateId = value(formData, 'templateId')
  const [unit, template] = await Promise.all([
    prisma.unit.findFirst({ where: { id: unitId, isActive: true, property: { ownerId: session.userId } }, include: { property: true } }),
    prisma.inspectionTemplate.findFirst({ where: { id: templateId, orgId: session.userId, isActive: true } }),
  ])
  if (!unit || !template) fail('/inspections/new', 'Choose a valid unit and inspection template.')

  let items
  try { items = decodeInspectionChecklist(template.checklistJson) } catch { fail('/inspections/new', 'The selected template has an invalid checklist. Edit its preferences first.') }
  const requestedDueAt = dateValue(value(formData, 'dueAt'))
  const dueAt = requestedDueAt ?? new Date(Date.now() + template.defaultDueDays * 86_400_000)
  const customTitle = value(formData, 'title')
  const inspection = await prisma.inspection.create({
    data: {
      orgId: session.userId,
      unitId: unit.id,
      templateId: template.id,
      title: customTitle || `${template.name} - ${unit.property.name} ${unit.label}`,
      inspectionType: template.inspectionType,
      templateName: template.name,
      dueAt,
      requirePhotoForIssues: template.requirePhotoForIssues,
      requireNoteForIssues: template.requireNoteForIssues,
      includePhotosInReport: template.includePhotosInReport,
      reportTitle: template.reportTitle,
      items: { create: items.map((item, position) => ({ ...item, position })) },
    },
  })
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'inspection', entityId: inspection.id, action: 'inspection.created', summary: `Created ${inspection.title}.` })
  await syncOutlookCalendarForUser(session.userId).catch(() => null)
  revalidatePath('/inspections')
  redirect(`/inspections/${inspection.id}` as Route)
}

export async function saveInspectionAction(formData: FormData) {
  const session = await manager()
  const inspectionId = value(formData, 'inspectionId')
  const intent = value(formData, 'intent')
  const inspection = await prisma.inspection.findFirst({ where: { id: inspectionId, orgId: session.userId }, include: { items: { orderBy: { position: 'asc' } } } })
  if (!inspection) fail('/inspections', 'Inspection not found.')
  if (inspection.status === 'completed') fail(`/inspections/${inspection.id}`, 'Completed inspections are read-only.')

  const updates: Array<{ id: string; result: string; note: string | null; photoUrl: string | null; upload: File | null }> = []
  for (const item of inspection.items) {
    const result = value(formData, `result:${item.id}`)
    if (!['pending', 'pass', 'needs_attention', 'not_applicable'].includes(result)) fail(`/inspections/${inspection.id}`, 'Choose a valid result for every item.')
    const note = value(formData, `note:${item.id}`) || null
    const uploaded = formData.get(`photo:${item.id}`)
    const upload = uploaded instanceof File && uploaded.size ? uploaded : null
    if (upload) {
      const error = await validatePhotoFiles([upload])
      if (error) fail(`/inspections/${inspection.id}`, error)
    }
    updates.push({ id: item.id, result, note, photoUrl: item.photoUrl, upload })
  }

  if (intent === 'complete') {
    const pending = updates.find((item) => item.result === 'pending')
    if (pending) fail(`/inspections/${inspection.id}`, 'Complete or mark every checklist item before finishing the inspection.')
    const missingEvidence = updates.find((item) => item.result === 'needs_attention' && ((inspection.requireNoteForIssues && !item.note) || (inspection.requirePhotoForIssues && !item.photoUrl && !item.upload)))
    if (missingEvidence) fail(`/inspections/${inspection.id}`, 'Items needing attention must include the evidence required by this inspection template.')
  }

  for (const item of updates) {
    if (item.upload) item.photoUrl = (await savePhotos([item.upload]))[0]
  }

  await prisma.$transaction([
    ...updates.map((item) => prisma.inspectionItem.update({ where: { id: item.id }, data: { result: item.result, note: item.note, photoUrl: item.photoUrl } })),
    prisma.inspection.update({ where: { id: inspection.id }, data: intent === 'complete' ? { status: 'completed', completedAt: new Date() } : {} }),
  ])
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'inspection', entityId: inspection.id, action: intent === 'complete' ? 'inspection.completed' : 'inspection.saved', summary: intent === 'complete' ? 'Completed inspection.' : 'Saved inspection draft.' })
  await syncOutlookCalendarForUser(session.userId).catch(() => null)
  revalidatePath(`/inspections/${inspection.id}`)
  revalidatePath('/inspections')
  revalidatePath(`/units/${inspection.unitId}`)
  redirect(`/inspections/${inspection.id}?${intent === 'complete' ? 'completed' : 'saved'}=1` as Route)
}

export async function createRequestFromInspectionFindingAction(formData: FormData) {
  const session = await manager()
  const itemId = value(formData, 'itemId')
  const item = await prisma.inspectionItem.findFirst({
    where: { id: itemId, inspection: { orgId: session.userId } },
    include: { inspection: { include: { unit: true } } },
  })
  if (!item || item.result !== 'needs_attention') fail('/inspections', 'Only a finding that needs attention can become a work order.')
  if (item.maintenanceRequestId) redirect(`/requests/${item.maintenanceRequestId}` as Route)
  const request = await prisma.$transaction(async (tx) => {
    const current = await tx.inspectionItem.findUnique({ where: { id: item.id } })
    if (current?.maintenanceRequestId) return tx.maintenanceRequest.findUniqueOrThrow({ where: { id: current.maintenanceRequestId } })
    const created = await tx.maintenanceRequest.create({
      data: {
        propertyId: item.inspection.unit.propertyId,
        unitId: item.inspection.unitId,
        orgId: session.userId,
        submittedByUserId: session.userId,
        title: `Inspection finding: ${item.label}`,
        description: item.note || `Issue identified during ${item.inspection.title}.`,
        category: 'Other',
        urgency: 'medium',
        status: 'approved',
        reviewState: 'approved',
        firstReviewedAt: new Date(),
      },
    })
    await tx.inspectionItem.update({ where: { id: item.id }, data: { maintenanceRequestId: created.id } })
    return created
  })
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'inspection', entityId: item.inspectionId, action: 'inspection.request_created', summary: `Created work order for ${item.label}.`, metadata: { requestId: request.id } })
  revalidatePath(`/inspections/${item.inspectionId}`)
  redirect(`/requests/${request.id}` as Route)
}

export async function saveInspectionTemplateAction(formData: FormData) {
  const session = await manager()
  const templateId = value(formData, 'templateId')
  const name = value(formData, 'name')
  const inspectionType = value(formData, 'inspectionType').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const reportTitle = value(formData, 'reportTitle') || 'Property inspection report'
  const defaultDueDays = Math.min(365, Math.max(0, Number.parseInt(value(formData, 'defaultDueDays'), 10) || 0))
  if (!name || !inspectionType) fail('/inspections/preferences', 'Template name and type are required.')
  let checklist
  try { checklist = parseInspectionChecklist(value(formData, 'checklist')) } catch (error) { fail('/inspections/preferences', error instanceof Error ? error.message : 'Invalid checklist.') }
  const data = {
    name,
    inspectionType,
    reportTitle,
    defaultDueDays,
    checklistJson: JSON.stringify(checklist),
    requirePhotoForIssues: formData.get('requirePhotoForIssues') === 'on',
    requireNoteForIssues: formData.get('requireNoteForIssues') === 'on',
    includePhotosInReport: formData.get('includePhotosInReport') === 'on',
  }
  if (templateId) {
    const template = await prisma.inspectionTemplate.findFirst({ where: { id: templateId, orgId: session.userId } })
    if (!template) fail('/inspections/preferences', 'Template not found.')
    await prisma.inspectionTemplate.update({ where: { id: template.id }, data })
  } else {
    await prisma.inspectionTemplate.create({ data: { orgId: session.userId, ...data } })
  }
  revalidatePath('/inspections/preferences')
  revalidatePath('/inspections/new')
  redirect('/inspections/preferences?saved=1')
}
