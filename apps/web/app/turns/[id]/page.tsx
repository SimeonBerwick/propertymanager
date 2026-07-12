import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createRequestFromTurnTaskAction, markUnitTurnReadyAction, saveUnitTurnTaskAction } from '@/app/turns/actions'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { daysBetween } from '@/lib/unit-turn-templates'
import { formatDateOnly } from '@/lib/ui-utils'

export default async function TurnDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; ready?: string; error?: string }> }) {
  const session = await getLandlordSession(); if (!session) redirect('/login?error=session-expired')
  const [{ id }, query] = await Promise.all([params, searchParams])
  const [turn, vendors] = await Promise.all([
    prisma.unitTurn.findFirst({ where: { id, orgId: session.userId }, include: { unit: { include: { property: true } }, tasks: { include: { assignedVendor: true }, orderBy: { position: 'asc' } } } }),
    prisma.vendor.findMany({ where: { orgId: session.userId, isActive: true }, orderBy: { name: 'asc' } }),
  ])
  if (!turn) notFound()
  const done = turn.tasks.filter((task) => task.status === 'completed').length
  const readOnly = turn.status === 'ready'
  const now = new Date()
  return <div className="stack"><div className="row"><div><Link href="/turns">Unit turns</Link><h1>{turn.title}</h1><p className="muted">{turn.unit.property.name} - {turn.unit.label} | Move-out {formatDateOnly(turn.moveOutAt.toISOString())}</p></div><div className="row"><span className="badge">{turn.status.replaceAll('_', ' ')}</span><a className="button" target="_blank" rel="noreferrer" href={`/api/turns/${turn.id}/report`}>Print report</a></div></div>
    {query.saved ? <div className="notice success">Turn task saved.</div> : null}{query.ready ? <div className="notice success">Unit marked ready for move-in.</div> : null}{query.error ? <div className="notice error">{query.error}</div> : null}
    <section className="grid cols-3"><div className="card"><div className="kicker">Progress</div><h2>{done}/{turn.tasks.length}</h2><div className="muted">Tasks complete</div></div><div className="card"><div className="kicker">Vacant</div><h2>{daysBetween(turn.moveOutAt, turn.readyAt ?? now)} days</h2><div className="muted">Since move-out</div></div><div className="card"><div className="kicker">Target move-in</div><h2>{turn.targetMoveInAt ? formatDateOnly(turn.targetMoveInAt.toISOString()) : 'Not set'}</h2><div className="muted">{turn.targetMoveInAt && !readOnly && turn.targetMoveInAt < now ? 'Past target' : 'Current target'}</div></div></section>
    <section className="stack"><h2>Turn checklist</h2>{turn.tasks.map((task, index) => <article className="card stack" key={task.id}><div className="row"><div><div className="kicker">Task {index + 1}</div><h3>{task.title}</h3></div><span className="badge">{task.status.replaceAll('_', ' ')}</span></div><div className="muted">Due {task.dueAt ? formatDateOnly(task.dueAt.toISOString()) : 'not set'} | Expected {task.expectedDays} day{task.expectedDays === 1 ? '' : 's'}</div>
      <form action={saveUnitTurnTaskAction} encType="multipart/form-data" className="stack"><input type="hidden" name="taskId" value={task.id} /><div className="grid cols-2"><label>Status<select name="status" defaultValue={task.status} disabled={readOnly}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option></select></label><label>Assigned to<select name="assignedType" defaultValue={task.assignedType} disabled={readOnly}><option value="manager">Property manager</option><option value="vendor">Vendor</option></select></label></div><label>Vendor<select name="assignedVendorId" defaultValue={task.assignedVendorId ?? ''} disabled={readOnly}><option value="">No vendor selected</option>{vendors.map((vendor) => <option value={vendor.id} key={vendor.id}>{vendor.name}</option>)}</select></label><label>Work notes<textarea rows={2} name="note" defaultValue={task.note ?? ''} disabled={readOnly} /></label><label>Completion photo<input type="file" accept="image/*" name="photo" disabled={readOnly} /></label>{task.photoUrl ? <a href={`/api/turns/media/${task.id}`} target="_blank" rel="noreferrer"><img src={`/api/turns/media/${task.id}`} alt={`Evidence for ${task.title}`} style={{ width: 180, maxHeight: 130, objectFit: 'cover', borderRadius: 6 }} /></a> : null}{!readOnly ? <button className="button primary" type="submit">Save task</button> : null}</form>
      <div className="row">{task.maintenanceRequestId ? <Link className="button" href={`/requests/${task.maintenanceRequestId}`}>View work order</Link> : !readOnly ? <form action={createRequestFromTurnTaskAction}><button className="button" name="taskId" value={task.id}>Create work order</button></form> : null}{task.assignedVendor ? <span className="muted">Assigned vendor: {task.assignedVendor.name}</span> : null}</div>
    </article>)}</section>
    {!readOnly ? <form action={markUnitTurnReadyAction} className="card row"><input type="hidden" name="turnId" value={turn.id} /><div><strong>Ready approval</strong><div className="muted">{turn.requireAllTasksForReady ? 'Every task must be complete.' : 'At least one completed task is required.'}</div></div><button className="button primary" type="submit">Mark unit ready</button></form> : null}
  </div>
}
