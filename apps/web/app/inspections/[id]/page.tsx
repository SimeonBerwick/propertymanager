import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createRequestFromInspectionFindingAction, saveInspectionAction } from '@/app/inspections/actions'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { formatDateOnly } from '@/lib/ui-utils'

const RESULT_OPTIONS = [
  ['pending', 'Not checked'], ['pass', 'Pass'], ['needs_attention', 'Needs attention'], ['not_applicable', 'Not applicable'],
] as const

export default async function InspectionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; completed?: string; error?: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const [{ id }, query] = await Promise.all([params, searchParams])
  const inspection = await prisma.inspection.findFirst({
    where: { id, orgId: session.userId },
    include: { unit: { include: { property: true } }, items: { orderBy: { position: 'asc' } } },
  })
  if (!inspection) notFound()
  const groups = new Map<string, typeof inspection.items>()
  for (const item of inspection.items) groups.set(item.section, [...(groups.get(item.section) ?? []), item])
  const completed = inspection.status === 'completed'
  const findings = inspection.items.filter((item) => item.result === 'needs_attention').length

  return <div className="stack">
    <div className="row"><div><Link href="/inspections">Inspections</Link><h1>{inspection.title}</h1><p className="muted">{inspection.unit.property.name} - {inspection.unit.label} | Due {inspection.dueAt ? formatDateOnly(inspection.dueAt.toISOString()) : 'not set'}</p></div><div className="row"><span className="badge">{completed ? 'Completed' : 'Draft'}</span><a className="button" href={`/api/inspections/${inspection.id}/report`} target="_blank" rel="noreferrer">Print report</a></div></div>
    {query.saved ? <div className="notice success">Inspection draft saved.</div> : null}{query.completed ? <div className="notice success">Inspection completed. The report is ready.</div> : null}{query.error ? <div className="notice error">{query.error}</div> : null}
    <section className="grid cols-3"><div className="card"><div className="kicker">Checklist</div><h2>{inspection.items.length}</h2><div className="muted">Total items</div></div><div className="card"><div className="kicker">Findings</div><h2>{findings}</h2><div className="muted">Need attention</div></div><div className="card"><div className="kicker">Evidence rules</div><div>{inspection.requirePhotoForIssues ? 'Photo required' : 'Photo optional'}</div><div>{inspection.requireNoteForIssues ? 'Note required' : 'Note optional'}</div></div></section>
    <form action={saveInspectionAction} encType="multipart/form-data" className="stack">
      <input type="hidden" name="inspectionId" value={inspection.id} />
      {[...groups.entries()].map(([section, items]) => <section className="card stack" key={section}><div><div className="kicker">Inspection section</div><h2>{section}</h2></div>
        {items.map((item) => <div key={item.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }} className="stack">
          <div className="row"><strong>{item.label}</strong>{item.maintenanceRequestId ? <Link className="button" href={`/requests/${item.maintenanceRequestId}`}>View work order</Link> : null}</div>
          <div className="grid cols-2"><label>Result<select name={`result:${item.id}`} defaultValue={item.result} disabled={completed}>{RESULT_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Evidence photo<input type="file" name={`photo:${item.id}`} accept="image/*" disabled={completed} /></label></div>
          <label>Notes<textarea name={`note:${item.id}`} rows={2} defaultValue={item.note ?? ''} disabled={completed} /></label>
          {item.photoUrl ? <a href={`/api/inspections/media/${item.id}`} target="_blank" rel="noreferrer"><img src={`/api/inspections/media/${item.id}`} alt={`Evidence for ${item.label}`} style={{ width: 180, maxHeight: 130, objectFit: 'cover', borderRadius: 6 }} /></a> : null}
          {completed && item.result === 'needs_attention' && !item.maintenanceRequestId ? <button className="button" formAction={createRequestFromInspectionFindingAction} name="itemId" value={item.id}>Create maintenance request</button> : null}
        </div>)}
      </section>)}
      {!completed ? <div className="row"><button className="button" type="submit" name="intent" value="save">Save draft</button><button className="button primary" type="submit" name="intent" value="complete">Complete inspection</button></div> : null}
    </form>
  </div>
}
