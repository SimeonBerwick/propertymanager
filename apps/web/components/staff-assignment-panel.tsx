import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { getStaffAssignmentRecommendation } from '@/lib/staff-assignment'
import { assignStaffToRequestAction } from '@/app/staff/actions'

export async function StaffAssignmentPanel({ requestId }: { requestId: string }) {
  const session = await getLandlordSession()
  if (!session) return null
  const [request, staff, recommendation] = await Promise.all([
    prisma.maintenanceRequest.findFirst({
      where: { id: requestId, property: { ownerId: session.userId } },
      select: { assignedStaffId: true, assignedStaffName: true, staffWorkStatus: true, staffResponseDueAt: true, staffWorkLogs: { orderBy: { createdAt: 'desc' }, take: 5, include: { staffMember: true } } },
    }),
    prisma.staffMember.findMany({ where: { orgId: session.userId, isActive: true }, orderBy: { name: 'asc' } }),
    getStaffAssignmentRecommendation(requestId, session.userId),
  ])
  if (!request || !staff.length) return null
  const defaultStaffId = request.assignedStaffId ?? recommendation?.staff?.id ?? ''
  return <section className="card stack">
    <div className="row"><div><div className="kicker">In-house maintenance</div><h3>{request.assignedStaffName ?? 'Assign staff'}</h3>{request.staffWorkStatus ? <div className="muted">Current status: {request.staffWorkStatus.replaceAll('_', ' ')}</div> : null}</div><a className="button" href="/staff/preferences">Assignment preferences</a></div>
    {recommendation ? <div className="notice"><strong>Recommended path: {recommendation.mode.replaceAll('_', ' ')}</strong><div className="muted">{recommendation.reason}{recommendation.mode === 'staff_first' ? ` Staff have ${recommendation.fallbackHours} hours to respond before fallback.` : ''}</div></div> : null}
    <form action={assignStaffToRequestAction} className="row"><input type="hidden" name="requestId" value={requestId} /><label style={{ flex: 1 }}>Staff member<select name="staffId" defaultValue={defaultStaffId}><option value="">No staff assignment</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name} - {member.availabilityStatus}</option>)}</select></label><button className="button primary">Save staff assignment</button></form>
    {request.staffResponseDueAt && request.staffWorkStatus === 'assigned' ? <div className="muted">Waiting for response until {request.staffResponseDueAt.toLocaleString('en-US')}.</div> : null}
    {request.staffWorkLogs.length ? <div className="stack"><strong>Recent staff updates</strong>{request.staffWorkLogs.map((log) => <div className="timelineRow" key={log.id}><div>{log.staffMember.name} - {log.status.replaceAll('_', ' ')} - {log.laborMinutes} minutes</div>{log.note ? <div className="muted">{log.note}</div> : null}{log.photoUrl ? <a href={`/api/staff/media/${log.id}`} target="_blank" rel="noreferrer">View work photo</a> : null}</div>)}</div> : null}
  </section>
}
