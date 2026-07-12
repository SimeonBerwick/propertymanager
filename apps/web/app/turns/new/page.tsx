import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createUnitTurnAction } from '@/app/turns/actions'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { ensureDefaultUnitTurnTemplate } from '@/lib/unit-turn-templates'

export default async function NewTurnPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getLandlordSession(); if (!session) redirect('/login?error=session-expired')
  await ensureDefaultUnitTurnTemplate(session.userId)
  const [units, templates, query] = await Promise.all([
    prisma.unit.findMany({ where: { isActive: true, locationType: 'residential', property: { ownerId: session.userId, isActive: true } }, include: { property: true }, orderBy: [{ property: { name: 'asc' } }, { label: 'asc' }] }),
    prisma.unitTurnTemplate.findMany({ where: { orgId: session.userId, isActive: true }, orderBy: { name: 'asc' } }), searchParams,
  ])
  return <div className="stack"><div><Link href="/turns">Unit turns</Link><h1>Start unit turn</h1></div>{query.error ? <div className="notice error">{query.error}</div> : null}<form action={createUnitTurnAction} className="card stack"><label>Residential unit<select name="unitId" required defaultValue=""><option value="" disabled>Choose a unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.property.name} - {unit.label}</option>)}</select></label><label>Turn template<select name="templateId" required defaultValue=""><option value="" disabled>Choose a template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label>Move-out date<input required type="date" name="moveOutAt" /></label><label>Target move-in date <span className="muted">(optional)</span><input type="date" name="targetMoveInAt" /></label><label>Title <span className="muted">(optional)</span><input name="title" /></label><div className="row"><Link className="button" href="/turns">Cancel</Link><button className="button primary" type="submit">Create turn plan</button></div></form></div>
}
