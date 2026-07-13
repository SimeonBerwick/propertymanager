'use server'

import type { Route } from 'next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { decodeUnitTurnTasks, parseUnitTurnTasks, turnReadyError, turnTaskCompletionError, type UnitTurnTemplateTask } from '@/lib/unit-turn-templates'
import { savePhotos, validatePhotoFiles } from '@/lib/photo-upload'
import { writeAuditLog } from '@/lib/audit-log'
import { syncOutlookCalendarForUser } from '@/lib/outlook-calendar-sync'

const value = (data: FormData, name: string) => String(data.get(name) ?? '').trim()
const parseDate = (raw: string) => raw && !Number.isNaN(new Date(`${raw}T12:00:00`).getTime()) ? new Date(`${raw}T12:00:00`) : null
function fail(path: string, message: string): never { redirect(`${path}?error=${encodeURIComponent(message)}` as Route) }
async function manager() { const session = await getLandlordSession(); if (!session) redirect('/login?error=session-expired'); return session }

export async function createUnitTurnAction(formData: FormData) {
  const session = await manager()
  const [unit, template] = await Promise.all([
    prisma.unit.findFirst({ where: { id: value(formData, 'unitId'), locationType: 'residential', property: { ownerId: session.userId } }, include: { property: true } }),
    prisma.unitTurnTemplate.findFirst({ where: { id: value(formData, 'templateId'), orgId: session.userId, isActive: true } }),
  ])
  if (!unit || !template) return fail('/turns/new', 'Choose a valid residential unit and turn template.')
  const moveOutAt = parseDate(value(formData, 'moveOutAt'))
  if (!moveOutAt) return fail('/turns/new', 'Choose a valid move-out date.')
  let tasks: UnitTurnTemplateTask[]
  try { tasks = decodeUnitTurnTasks(template.tasksJson) } catch { return fail('/turns/new', 'The selected template has invalid tasks. Edit its preferences first.') }
  const targetMoveInAt = parseDate(value(formData, 'targetMoveInAt')) ?? new Date(moveOutAt.getTime() + template.defaultTargetDays * 86_400_000)
  if (targetMoveInAt < moveOutAt) return fail('/turns/new', 'Target move-in cannot be before move-out.')
  if (await prisma.unitTurn.findFirst({ where: { unitId: unit.id, orgId: session.userId, status: { not: 'ready' } } })) return fail('/turns/new', 'This unit already has an active turn.')
  let elapsed = 0
  const turn = await prisma.unitTurn.create({ data: {
    orgId: session.userId, unitId: unit.id, templateId: template.id, templateName: template.name,
    title: value(formData, 'title') || `${unit.property.name} ${unit.label} turn`, moveOutAt, targetMoveInAt,
    requirePhotoForCompletion: template.requirePhotoForCompletion, requireNoteForCompletion: template.requireNoteForCompletion,
    requireAllTasksForReady: template.requireAllTasksForReady,
    tasks: { create: tasks.map((task, position) => { elapsed += task.expectedDays; return { ...task, position, dueAt: new Date(moveOutAt.getTime() + elapsed * 86_400_000) } }) },
  } })
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'unit_turn', entityId: turn.id, action: 'unit_turn.created', summary: `Created ${turn.title}.` })
  await syncOutlookCalendarForUser(session.userId).catch(() => null)
  revalidatePath('/turns'); revalidatePath(`/units/${unit.id}`)
  redirect(`/turns/${turn.id}` as Route)
}

export async function saveUnitTurnTaskAction(formData: FormData) {
  const session = await manager()
  const task = await prisma.unitTurnTask.findFirst({ where: { id: value(formData, 'taskId'), turn: { orgId: session.userId } }, include: { turn: true } })
  if (!task) fail('/turns', 'Turn task not found.')
  if (task.turn.status === 'ready') fail(`/turns/${task.turnId}`, 'A ready unit turn is read-only.')
  const status = value(formData, 'status')
  const assignedType = value(formData, 'assignedType')
  if (!['not_started', 'in_progress', 'blocked', 'completed'].includes(status) || !['manager', 'vendor'].includes(assignedType)) fail(`/turns/${task.turnId}`, 'Choose a valid task status and assignment.')
  const note = value(formData, 'note') || null
  let assignedVendorId = assignedType === 'vendor' ? value(formData, 'assignedVendorId') || null : null
  if (assignedVendorId && !await prisma.vendor.findFirst({ where: { id: assignedVendorId, orgId: session.userId, isActive: true } })) assignedVendorId = null
  if (assignedType === 'vendor' && !assignedVendorId) fail(`/turns/${task.turnId}`, 'Choose a vendor before assigning this task to a vendor.')
  const uploaded = formData.get('photo')
  const upload = uploaded instanceof File && uploaded.size ? uploaded : null
  if (upload) { const error = await validatePhotoFiles([upload]); if (error) fail(`/turns/${task.turnId}`, error) }
  const completionError = turnTaskCompletionError({ status, note, hasPhoto: Boolean(task.photoUrl || upload), requireNote: task.turn.requireNoteForCompletion, requirePhoto: task.turn.requirePhotoForCompletion })
  if (completionError) fail(`/turns/${task.turnId}`, completionError)
  const photoUrl = upload ? (await savePhotos([upload]))[0] : task.photoUrl
  await prisma.$transaction([
    prisma.unitTurnTask.update({ where: { id: task.id }, data: { status, assignedType, assignedVendorId, note, photoUrl, completedAt: status === 'completed' ? task.completedAt ?? new Date() : null } }),
    prisma.unitTurn.update({ where: { id: task.turnId }, data: task.turn.status === 'planned' && status !== 'not_started' ? { status: 'in_progress' } : {} }),
  ])
  await syncOutlookCalendarForUser(session.userId).catch(() => null)
  revalidatePath(`/turns/${task.turnId}`); revalidatePath('/turns')
  redirect(`/turns/${task.turnId}?saved=1` as Route)
}

export async function markUnitTurnReadyAction(formData: FormData) {
  const session = await manager()
  const turn = await prisma.unitTurn.findFirst({ where: { id: value(formData, 'turnId'), orgId: session.userId }, include: { tasks: true } })
  if (!turn) fail('/turns', 'Unit turn not found.')
  const readyError = turnReadyError(turn.tasks.map((task) => task.status), turn.requireAllTasksForReady)
  if (readyError) fail(`/turns/${turn.id}`, readyError)
  await prisma.unitTurn.update({ where: { id: turn.id }, data: { status: 'ready', readyAt: new Date() } })
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'unit_turn', entityId: turn.id, action: 'unit_turn.ready', summary: 'Marked unit ready for move-in.' })
  await syncOutlookCalendarForUser(session.userId).catch(() => null)
  revalidatePath(`/turns/${turn.id}`); revalidatePath('/turns'); revalidatePath(`/units/${turn.unitId}`)
  redirect(`/turns/${turn.id}?ready=1` as Route)
}

export async function createRequestFromTurnTaskAction(formData: FormData) {
  const session = await manager()
  const task = await prisma.unitTurnTask.findFirst({ where: { id: value(formData, 'taskId'), turn: { orgId: session.userId } }, include: { assignedVendor: true, turn: { include: { unit: true } } } })
  if (!task) fail('/turns', 'Turn task not found.')
  if (task.maintenanceRequestId) redirect(`/requests/${task.maintenanceRequestId}` as Route)
  const request = await prisma.$transaction(async (tx) => {
    const current = await tx.unitTurnTask.findUnique({ where: { id: task.id } })
    if (current?.maintenanceRequestId) return tx.maintenanceRequest.findUniqueOrThrow({ where: { id: current.maintenanceRequestId } })
    const created = await tx.maintenanceRequest.create({ data: { propertyId: task.turn.unit.propertyId, unitId: task.turn.unitId, orgId: session.userId, submittedByUserId: session.userId, title: `Unit turn: ${task.title}`, description: task.note || `Work required for ${task.turn.title}.`, category: 'Other', urgency: 'medium', status: 'approved', reviewState: 'approved', firstReviewedAt: new Date(), assignedVendorId: task.assignedVendorId, assignedVendorName: task.assignedVendor?.name, assignedVendorEmail: task.assignedVendor?.email, assignedVendorPhone: task.assignedVendor?.phone, dispatchStatus: task.assignedVendorId ? 'assigned' : undefined } })
    await tx.unitTurnTask.update({ where: { id: task.id }, data: { maintenanceRequestId: created.id } })
    return created
  })
  revalidatePath(`/turns/${task.turnId}`)
  redirect(`/requests/${request.id}` as Route)
}

export async function saveUnitTurnTemplateAction(formData: FormData) {
  const session = await manager()
  const templateId = value(formData, 'templateId')
  const name = value(formData, 'name')
  if (!name) fail('/turns/preferences', 'Template name is required.')
  let tasks
  try { tasks = parseUnitTurnTasks(value(formData, 'tasks')) } catch (error) { fail('/turns/preferences', error instanceof Error ? error.message : 'Invalid tasks.') }
  const data = { name, tasksJson: JSON.stringify(tasks), defaultTargetDays: Math.min(180, Math.max(1, Number.parseInt(value(formData, 'defaultTargetDays'), 10) || 10)), requirePhotoForCompletion: formData.get('requirePhotoForCompletion') === 'on', requireNoteForCompletion: formData.get('requireNoteForCompletion') === 'on', requireAllTasksForReady: formData.get('requireAllTasksForReady') === 'on' }
  if (templateId) {
    const existing = await prisma.unitTurnTemplate.findFirst({ where: { id: templateId, orgId: session.userId } })
    if (!existing) fail('/turns/preferences', 'Template not found.')
    await prisma.unitTurnTemplate.update({ where: { id: existing.id }, data })
  } else await prisma.unitTurnTemplate.create({ data: { orgId: session.userId, ...data } })
  revalidatePath('/turns/preferences'); revalidatePath('/turns/new')
  redirect('/turns/preferences?saved=1')
}

export async function saveTurnBoardPreferencesAction(formData: FormData) {
  const session = await manager()
  const status = value(formData, 'status')
  if (!['active', 'all', 'ready', 'planned', 'in_progress'].includes(status)) fail('/turns/preferences', 'Choose a valid board filter.')
  const propertyId = value(formData, 'propertyId') || null
  if (propertyId && !await prisma.property.findFirst({ where: { id: propertyId, ownerId: session.userId } })) fail('/turns/preferences', 'Choose a valid property.')
  await prisma.user.update({ where: { id: session.userId }, data: { turnBoardStatusFilter: status, turnBoardPropertyFilter: propertyId } })
  revalidatePath('/turns'); revalidatePath('/turns/preferences')
  redirect('/turns/preferences?viewSaved=1')
}
