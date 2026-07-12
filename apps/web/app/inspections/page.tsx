import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { ensureDefaultInspectionTemplates } from '@/lib/inspection-templates'
import { formatDateOnly } from '@/lib/ui-utils'

export default async function InspectionsPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  await ensureDefaultInspectionTemplates(session.userId)
  const inspections = await prisma.inspection.findMany({
    where: { orgId: session.userId },
    include: { unit: { include: { property: true } }, items: { select: { result: true } } },
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
  })
  const now = new Date()
  const due = inspections.filter((item) => item.status !== 'completed' && item.dueAt && item.dueAt < now).length
  const drafts = inspections.filter((item) => item.status !== 'completed').length
  const completed = inspections.filter((item) => item.status === 'completed').length

  return <div className="stack">
    <section className="row">
      <div><div className="kicker">Portfolio condition</div><h1>Inspections</h1><p className="muted">Complete consistent inspections, preserve evidence, and turn findings into work orders.</p></div>
      <div className="row"><Link className="button" href="/inspections/preferences">Preferences</Link><Link className="button primary" href="/inspections/new">New inspection</Link></div>
    </section>
    <section className="grid cols-3">
      <div className="card"><div className="kicker">Open</div><h2>{drafts}</h2><div className="muted">Draft or in progress</div></div>
      <div className="card"><div className="kicker">Overdue</div><h2>{due}</h2><div className="muted">Past due and incomplete</div></div>
      <div className="card"><div className="kicker">Completed</div><h2>{completed}</h2><div className="muted">Ready for reporting</div></div>
    </section>
    <section className="card stack">
      <h2>Inspection history</h2>
      {inspections.length ? <table className="table"><thead><tr><th>Inspection</th><th>Property / unit</th><th>Due</th><th>Findings</th><th>Status</th></tr></thead><tbody>
        {inspections.map((inspection) => {
          const findings = inspection.items.filter((item) => item.result === 'needs_attention').length
          const overdue = inspection.status !== 'completed' && inspection.dueAt && inspection.dueAt < now
          return <tr key={inspection.id}><td><Link href={`/inspections/${inspection.id}`}><strong>{inspection.title}</strong></Link><div className="muted">{inspection.templateName}</div></td><td>{inspection.unit.property.name}<div className="muted">{inspection.unit.label}</div></td><td className={overdue ? 'dangerText' : ''}>{inspection.dueAt ? formatDateOnly(inspection.dueAt.toISOString()) : 'Not set'}</td><td>{findings}</td><td><span className="badge">{inspection.status === 'completed' ? 'Completed' : overdue ? 'Overdue' : 'Draft'}</span></td></tr>
        })}
      </tbody></table> : <div className="emptyState"><strong>No inspections yet</strong><span>Start with a saved template and the checklist will be ready to use.</span><Link className="button primary" href="/inspections/new">New inspection</Link></div>}
    </section>
  </div>
}
