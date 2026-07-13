'use server'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { calculatePersonalWorkCharge } from '@/lib/personal-work'
import { writeAuditLog } from '@/lib/audit-log'

const value = (data: FormData, key: string) => String(data.get(key) ?? '').trim()
const fail = (requestId: string, message: string): never => redirect(`/requests/${requestId}?error=${encodeURIComponent(message)}` as Route)
async function ownedRequest(formData: FormData) { const session = await getLandlordSession(); if (!session) redirect('/login?error=session-expired'); const requestId = value(formData, 'requestId'); const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, property: { ownerId: session.userId } }, include: { staffWorkLogs: true, billingDocuments: true } }); if (!request || request.workResponsibility !== 'tenant_personal_work') fail(requestId, 'Personal work request not found.'); return { session, request: request! } }

export async function reviewPersonalWorkAction(formData: FormData) {
  const { session, request } = await ownedRequest(formData); const decision = value(formData, 'decision')
  if (!['approved', 'declined'].includes(decision)) fail(request.id, 'Choose approve or decline.')
  await prisma.maintenanceRequest.update({ where: { id: request.id }, data: { personalWorkStatus: decision, personalWorkManagerApprovedAt: decision === 'approved' ? new Date() : null, reviewState: decision === 'approved' ? 'approved' : 'none', reviewNote: decision === 'approved' ? 'Tenant-paid personal work approved for staff assignment.' : 'Tenant-paid personal work declined.' } })
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'request', entityId: request.id, action: `personalWork.${decision}`, summary: `Tenant-paid personal work ${decision}.` })
  revalidatePath(`/requests/${request.id}`); redirect(`/requests/${request.id}?personalWork=${decision}` as Route)
}

export async function createPersonalWorkInvoiceAction(formData: FormData) {
  const { session, request } = await ownedRequest(formData)
  if (request.personalWorkStatus !== 'completed_pending_review' || request.status !== 'completed') fail(request.id, 'Staff must complete the personal work before billing.')
  if (request.personalWorkBilledAt || request.billingDocuments.some((document) => document.title === 'Tenant-requested personal work')) fail(request.id, 'This personal work has already been billed.')
  const authorizedMaxCents = request.personalWorkAuthorizedMaxCents ?? 0
  const charge = calculatePersonalWorkCharge({ laborMinutes: request.staffWorkLogs.map((log) => log.laborMinutes), materialsCents: request.staffWorkLogs.map((log) => log.materialsCents), hourlyRateCents: request.personalWorkHourlyRateCents ?? 0, minimumMinutes: request.personalWorkMinimumMinutes ?? 0, authorizedMaxCents })
  const submittedCents = Math.round(Number(value(formData, 'invoiceAmount')) * 100)
  if (!Number.isInteger(submittedCents) || submittedCents < 0 || submittedCents > authorizedMaxCents || submittedCents > charge.calculatedCents) fail(request.id, 'Invoice amount must not exceed the work total or tenant authorization.')
  await prisma.$transaction([prisma.billingDocument.create({ data: { requestId: request.id, recipientType: 'tenant', documentType: 'tenant_invoice', status: 'draft', currency: request.preferredCurrency, totalCents: submittedCents, title: 'Tenant-requested personal work', description: `${charge.billableMinutes} billable labor minutes ($${(charge.laborCents / 100).toFixed(2)}) plus materials ($${(charge.materialsCents / 100).toFixed(2)}). Tenant authorization: $${(authorizedMaxCents / 100).toFixed(2)}.`, createdByUserId: session.userId } }), prisma.maintenanceRequest.update({ where: { id: request.id }, data: { personalWorkStatus: 'billed', personalWorkBilledAt: new Date(), reviewState: 'none', reviewNote: 'Tenant personal-work invoice drafted.' } })])
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'request', entityId: request.id, action: 'personalWork.billed', summary: `Created tenant personal-work invoice for $${(submittedCents / 100).toFixed(2)}.` })
  revalidatePath(`/requests/${request.id}`); revalidatePath('/billing'); redirect(`/requests/${request.id}?personalWork=billed` as Route)
}
