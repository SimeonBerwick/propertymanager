import { Breadcrumbs } from '@/components/breadcrumbs'
import { NewPropertyForm } from './new-property-form'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { checkUnitCapacity } from '@/lib/account-limits'

export default async function NewPropertyPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const capacity = await checkUnitCapacity(session.userId)
  return (
    <div className="stack" style={{ maxWidth: 640, margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Properties', href: '/properties' }, { label: 'Add property' }]} />

      <section className="card stack">
        <div>
          <div className="kicker">Properties</div>
          <h2 style={{ margin: '4px 0 0' }}>Add a property</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Choose the property type. Apartment communities can create their initial units all at once.
        </p>
        {capacity.freeTrial ? <div className="notice">Free trial: load your actual properties and units without purchasing capacity. Your first bill will use the active-unit count when you subscribe. <Link href="/account/subscription">See projected pricing</Link></div> : capacity.limit != null ? <div className="notice">You are using {capacity.activeUnits} of {capacity.limit} purchased unit slots. Buy enough capacity before creating a larger apartment community. <Link href="/account/subscription">Increase unit capacity</Link></div> : null}
      </section>

      <section className="card stack">
        <NewPropertyForm />
      </section>
    </div>
  )
}
