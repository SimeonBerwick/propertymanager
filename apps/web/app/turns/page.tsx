import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { ensureDefaultUnitTurnTemplate, daysBetween } from '@/lib/unit-turn-templates'
import { formatDateOnly } from '@/lib/ui-utils'

export default async function UnitTurnsPage({ searchParams }: { searchParams: Promise<{ status?: string; propertyId?: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  await ensureDefaultUnitTurnTemplate(session.userId)
  const [user, properties, query] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.userId }, select: { turnBoardStatusFilter: true, turnBoardPropertyFilter: true } }),
    prisma.property.findMany({ where: { ownerId: session.userId, isActive: true }, orderBy: { name: 'asc' } }), searchParams,
  ])
  const status = query.status || user.turnBoardStatusFilter
  const propertyId = query.propertyId === 'all' ? null : query.propertyId || user.turnBoardPropertyFilter
  const turns = await prisma.unitTurn.findMany({ where: { orgId: session.userId, ...(status === 'active' ? { status: { not: 'ready' } } : status === 'all' ? {} : { status }), ...(propertyId ? { unit: { propertyId } } : {}) }, include: { unit: { include: { property: true } }, tasks: true }, orderBy: [{ targetMoveInAt: 'asc' }, { createdAt: 'desc' }] })
  const completed = await prisma.unitTurn.findMany({ where: { orgId: session.userId, status: 'ready', readyAt: { not: null } }, select: { moveOutAt: true, readyAt: true } })
  const avgDays = completed.length ? completed.reduce((sum, turn) => sum + daysBetween(turn.moveOutAt, turn.readyAt!), 0) / completed.length : 0
  const now = new Date()
  return <div className="stack"><section className="row"><div><div className="kicker">Vacancy operations</div><h1>Unit turns</h1><p className="muted">Track every vacant unit from move-out through ready-for-move-in.</p></div><div className="row"><Link className="button" href="/turns/preferences">Preferences</Link><Link className="button primary" href="/turns/new">Start unit turn</Link></div></section>
    <section className="grid cols-3"><div className="card"><div className="kicker">Visible turns</div><h2>{turns.length}</h2><div className="muted">Using current board view</div></div><div className="card"><div className="kicker">Past target</div><h2>{turns.filter((turn) => turn.status !== 'ready' && turn.targetMoveInAt && turn.targetMoveInAt < now).length}</h2><div className="muted">Needs schedule attention</div></div><div className="card"><div className="kicker">Average turn</div><h2>{avgDays.toFixed(1)} days</h2><div className="muted">Completed turns</div></div></section>
    <form method="GET" className="card row"><label>Status<select name="status" defaultValue={status}><option value="active">Active</option><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="ready">Ready</option><option value="all">All</option></select></label><label>Property<select name="propertyId" defaultValue={propertyId ?? 'all'}><option value="all">All properties</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><button className="button" type="submit">Apply view</button></form>
    <section className="card stack"><h2>Turn board</h2>{turns.length ? <table className="table"><thead><tr><th>Unit</th><th>Progress</th><th>Target</th><th>Vacant</th><th>Next work</th><th>Status</th></tr></thead><tbody>{turns.map((turn) => { const done = turn.tasks.filter((task) => task.status === 'completed').length; const next = turn.tasks.find((task) => task.status !== 'completed'); const overdue = turn.status !== 'ready' && turn.targetMoveInAt && turn.targetMoveInAt < now; return <tr key={turn.id}><td><Link href={`/turns/${turn.id}`}><strong>{turn.unit.property.name}</strong><div>{turn.unit.label}</div></Link></td><td>{done}/{turn.tasks.length}<div className="muted">{Math.round((done / Math.max(1, turn.tasks.length)) * 100)}%</div></td><td className={overdue ? 'dangerText' : ''}>{turn.targetMoveInAt ? formatDateOnly(turn.targetMoveInAt.toISOString()) : 'Not set'}</td><td>{daysBetween(turn.moveOutAt, turn.readyAt ?? now)} days</td><td>{next?.title ?? 'All tasks complete'}</td><td><span className="badge">{turn.status.replaceAll('_', ' ')}</span></td></tr>})}</tbody></table> : <div className="emptyState"><strong>No unit turns in this view</strong><span>A clear board is good news. Change the filter to review completed turns.</span></div>}</section>
  </div>
}
