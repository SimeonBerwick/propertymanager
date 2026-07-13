import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { REQUEST_CATEGORIES } from '@/lib/maintenance-options'
import { savePersonalWorkDefaultsAction, savePropertyPersonalWorkAction } from './actions'

const selected = (csv: string | null) => new Set(String(csv ?? '').split(',').filter(Boolean))

export default async function PersonalWorkSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const [account, properties, activeStaff, query] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.userId } }),
    prisma.property.findMany({ where: { ownerId: session.userId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.staffMember.count({ where: { orgId: session.userId, isActive: true } }),
    searchParams,
  ])
  return <div className="stack">
    <div><Link href="/staff">Maintenance staff</Link><h1>Tenant-paid personal work</h1><p className="muted">Offer optional minor personal jobs only where you allow them. Rates and authorization are saved on each request.</p></div>
    {query.saved ? <div className="notice success">Personal work preferences saved.</div> : null}
    {query.error ? <div className="notice error">{query.error}</div> : null}
    {!activeStaff ? <div className="notice">Add an active maintenance staff member before this option can appear to tenants.</div> : null}
    <form action={savePersonalWorkDefaultsAction} className="card stack">
      <h2>Portfolio defaults</h2>
      <label className="row"><input type="checkbox" name="enabled" defaultChecked={account.personalWorkEnabled} /> Allow tenant-paid personal work</label>
      <div className="grid cols-2"><label>Hourly rate ($)<input name="hourlyRate" type="number" min="0" max="100000" step="0.01" defaultValue={(account.personalWorkHourlyRateCents / 100).toFixed(2)} /></label><label>Minimum labor (minutes)<input name="minimumMinutes" type="number" min="0" max="480" defaultValue={account.personalWorkMinimumMinutes} /></label></div>
      <div><strong>Allowed categories</strong><div className="grid cols-3">{REQUEST_CATEGORIES.map((category) => <label className="row" key={category}><input type="checkbox" name="categories" value={category} defaultChecked={selected(account.personalWorkAllowedCategoriesCsv).has(category)} /> {category}</label>)}</div></div>
      <button className="button primary">Save portfolio defaults</button>
    </form>
    <section className="stack"><h2>Property availability</h2>{properties.map((property) => { const overrides = selected(property.personalWorkAllowedCategoriesCsv); return <form action={savePropertyPersonalWorkAction} className="card stack" key={property.id}><input type="hidden" name="propertyId" value={property.id} /><div className="row"><h3>{property.name}</h3><label className="row"><input type="checkbox" name="allowed" defaultChecked={property.personalWorkAllowed} /> Available here</label></div><div className="grid cols-2"><label>Hourly rate override ($)<input name="hourlyRate" type="number" min="0" step="0.01" placeholder="Use portfolio rate" defaultValue={property.personalWorkHourlyRateCents === null ? '' : (property.personalWorkHourlyRateCents / 100).toFixed(2)} /></label><label>Minimum minutes override<input name="minimumMinutes" type="number" min="0" max="480" placeholder="Use portfolio minimum" defaultValue={property.personalWorkMinimumMinutes ?? ''} /></label></div><div><strong>Category overrides</strong><div className="muted">Leave all unchecked to use the portfolio categories.</div><div className="grid cols-3">{REQUEST_CATEGORIES.map((category) => <label className="row" key={category}><input type="checkbox" name="categories" value={category} defaultChecked={overrides.has(category)} /> {category}</label>)}</div></div><button className="button">Save {property.name}</button></form>})}</section>
  </div>
}
