import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createInspectionAction } from '@/app/inspections/actions'
import { getLandlordSession } from '@/lib/landlord-session'
import { ensureDefaultInspectionTemplates } from '@/lib/inspection-templates'
import { prisma } from '@/lib/prisma'

export default async function NewInspectionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  await ensureDefaultInspectionTemplates(session.userId)
  const [units, templates, query] = await Promise.all([
    prisma.unit.findMany({ where: { isActive: true, property: { ownerId: session.userId, isActive: true } }, include: { property: true }, orderBy: [{ property: { name: 'asc' } }, { label: 'asc' }] }),
    prisma.inspectionTemplate.findMany({ where: { orgId: session.userId, isActive: true }, orderBy: { name: 'asc' } }),
    searchParams,
  ])
  return <div className="stack">
    <div><Link href="/inspections">Inspections</Link><h1>New inspection</h1></div>
    {query.error ? <div className="notice error">{query.error}</div> : null}
    {!units.length ? <div className="emptyState"><strong>Add an active unit first</strong><span>Inspections are attached to residential, common-area, or property-level units.</span><Link className="button" href="/properties">View properties</Link></div> :
    <form action={createInspectionAction} className="card stack">
      <label>Property and unit<select name="unitId" required defaultValue=""><option value="" disabled>Choose a unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.property.name} - {unit.label}</option>)}</select></label>
      <label>Inspection template<select name="templateId" required defaultValue=""><option value="" disabled>Choose a template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
      <label>Title <span className="muted">(optional)</span><input name="title" placeholder="Defaults to template, property, and unit" /></label>
      <label>Due date <span className="muted">(optional)</span><input name="dueAt" type="date" /></label>
      <div className="row"><Link className="button" href="/inspections">Cancel</Link><button className="button primary" type="submit">Create inspection</button></div>
    </form>}
  </div>
}
