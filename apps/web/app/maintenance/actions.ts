'use server'
import type { Route } from 'next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireStaffSession } from '@/lib/staff-auth'
import { parseDateTimeLocalInDisplayTimeZone } from '@/lib/appointment-time'
import { savePhotos, validatePhotoFiles } from '@/lib/photo-upload'
import { writeAuditLog } from '@/lib/audit-log'
import { parseStaffWorkAmounts } from '@/lib/staff-workflow'

export async function saveStaffWorkUpdateAction(formData: FormData) {
  const session = await requireStaffSession(); const requestId = String(formData.get('requestId') ?? ''); const status = String(formData.get('status') ?? ''); const note = String(formData.get('note') ?? '').trim()
  if (!['accepted', 'declined', 'in_progress', 'blocked', 'completed'].includes(status)) redirect(`/maintenance/requests/${requestId}?error=Invalid%20work%20status` as Route)
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, assignedStaffId: session.staffMemberId, property: { ownerId: session.orgId } } })
  if (!request) redirect('/maintenance?error=Work%20order%20not%20found')
  const amounts = parseStaffWorkAmounts(String(formData.get('laborHours') ?? '0'), String(formData.get('materialsAmount') ?? '0'))
  if (amounts.error) redirect(`/maintenance/requests/${request.id}?error=${encodeURIComponent(amounts.error)}` as Route)
  const { laborMinutes, materialsCents } = amounts
  const scheduledStart = parseDateTimeLocalInDisplayTimeZone(String(formData.get('scheduledStart') ?? ''))
  const scheduledEnd = parseDateTimeLocalInDisplayTimeZone(String(formData.get('scheduledEnd') ?? ''))
  if (scheduledStart && scheduledEnd && scheduledEnd < scheduledStart) redirect(`/maintenance/requests/${request.id}?error=Appointment%20end%20must%20be%20after%20the%20start` as Route)
  const rawPhoto = formData.get('photo'); const photo = rawPhoto instanceof File && rawPhoto.size ? rawPhoto : null
  if (photo) { const error = await validatePhotoFiles([photo]); if (error) redirect(`/maintenance/requests/${request.id}?error=${encodeURIComponent(error)}` as Route) }
  const photoUrl = photo ? (await savePhotos([photo]))[0] : null
  const requestStatus = status === 'in_progress' ? 'in_progress' : status === 'completed' ? 'completed' : request.status
  const personalWorkStatus = request.workResponsibility === 'tenant_personal_work' && status === 'completed' ? 'completed_pending_review' : request.workResponsibility === 'tenant_personal_work' && status === 'in_progress' ? 'in_progress' : request.personalWorkStatus
  const declined = status === 'declined'
  await prisma.$transaction([
    prisma.staffWorkLog.create({ data: { requestId: request.id, staffMemberId: session.staffMemberId, status, note: note || null, laborMinutes, materialsCents, photoUrl } }),
    prisma.maintenanceRequest.update({ where: { id: request.id }, data: { personalWorkStatus, assignedStaffId: declined ? null : request.assignedStaffId, staffWorkStatus: status, staffResponseDueAt: status === 'accepted' || declined ? null : request.staffResponseDueAt, staffDeclinedAt: declined ? new Date() : request.staffDeclinedAt, staffScheduledStart: scheduledStart ?? request.staffScheduledStart, staffScheduledEnd: scheduledEnd ?? request.staffScheduledEnd, status: requestStatus, actualCompletedAt: status === 'completed' ? new Date() : request.actualCompletedAt, reviewState: declined ? 'reassignment_needed' : status === 'completed' || status === 'blocked' ? 'needs_follow_up' : request.reviewState, reviewNote: declined ? note || 'In-house staff declined the assignment. Choose another staff member or vendor.' : status === 'completed' ? 'Review in-house staff completion.' : status === 'blocked' ? note || 'In-house staff reported a blocker.' : request.reviewNote } }),
  ])
  await writeAuditLog({ orgId: session.orgId, entityType: 'request', entityId: request.id, action: 'request.staffUpdate', summary: `${session.staffName} updated in-house work to ${status}.`, metadata: { staffMemberId: session.staffMemberId, laborMinutes, materialsCents } })
  revalidatePath('/maintenance'); revalidatePath(`/maintenance/requests/${request.id}`); revalidatePath(`/requests/${request.id}`)
  redirect((declined ? '/maintenance' : `/maintenance/requests/${request.id}?saved=1`) as Route)
}
