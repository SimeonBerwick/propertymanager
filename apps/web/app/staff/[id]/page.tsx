import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { formatDateTime } from '@/lib/ui-utils'
import { updateStaffMemberAction } from '../actions'

export default async function StaffDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; saved?: string; error?: string }> }) {
  const session = await getLandlordSession(); if (!session) redirect('/login?error=session-expired')
  const [{ id }, query] = await Promise.all([params, searchParams])
  const staff = await prisma.staffMember.findFirst({ where: { id, orgId: session.userId }, include: { assignedRequests: { include: { property: true, unit: true }, orderBy: { updatedAt: 'desc' }, take: 30 }, workLogs: { include: { request: true }, orderBy: { createdAt: 'desc' }, take: 20 } } })
  if (!staff) notFound()
  return <div className="stack"><div className="row"><div><Link href="/staff">Maintenance staff</Link><h1>{staff.name}</h1></div><Link className="button" href="/staff/preferences">Assignment preferences</Link></div>
    {query.created ? <div className="notice success">Staff account created. They can now sign in with their work email.</div> : null}{query.saved ? <div className="notice success">Staff account saved.</div> : null}{query.error ? <div className="notice error">{query.error}</div> : null}
    <section className="grid cols-2"><form action={updateStaffMemberAction} className="card stack"><input type="hidden" name="staffId" value={staff.id} /><h2>Account and capacity</h2><label>Name<input name="name" required defaultValue={staff.name} /></label><label>Work email<input type="email" name="email" required defaultValue={staff.email} /></label><label>Phone<input name="phone" defaultValue={staff.phone ?? ''} /></label><label>Skills<input name="skills" defaultValue={staff.skillsCsv ?? ''} /></label><label>Availability<select name="availabilityStatus" defaultValue={staff.availabilityStatus}><option value="available">Available</option><option value="busy">Busy</option><option value="unavailable">Unavailable</option></select></label><label>Maximum open assignments<input type="number" min="1" max="100" name="maxOpenAssignments" defaultValue={staff.maxOpenAssignments} /></label><label className="row"><input type="checkbox" name="isActive" defaultChecked={staff.isActive} /> Active staff account</label><button className="button primary">Save account</button></form>
      <section className="card stack"><h2>Assigned work</h2>{staff.assignedRequests.length ? staff.assignedRequests.map((request) => <Link href={`/requests/${request.id}`} key={request.id} className="timelineRow"><strong>{request.title}</strong><div className="muted">{request.property.name} - {request.unit.label} - {request.staffWorkStatus ?? 'assigned'}</div></Link>) : <div className="muted">No work assigned.</div>}</section></section>
    <section className="card stack"><h2>Recent work logs</h2>{staff.workLogs.length ? staff.workLogs.map((log) => <div className="timelineRow" key={log.id}><strong>{log.request.title}</strong><div>{log.status} - {log.laborMinutes} minutes - materials ${(log.materialsCents / 100).toFixed(2)}</div><div className="muted">{log.note || 'No note'} - {formatDateTime(log.createdAt)}</div>{log.photoUrl ? <a href={`/api/staff/media/${log.id}`} target="_blank" rel="noreferrer">View work photo</a> : null}</div>) : <div className="muted">No work logged yet.</div>}</section>
  </div>
}
