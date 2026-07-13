import { notFound, redirect } from 'next/navigation'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { getPropertyDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { NewUnitForm } from './new-unit-form'
import Link from 'next/link'
import { checkUnitCapacity } from '@/lib/account-limits'

export default async function NewUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')

  const { id } = await params
  const data = await getPropertyDetailData(id, session.userId)
  const capacity = await checkUnitCapacity(session.userId)

  if (!data) {
    notFound()
  }

  return (
    <div className="stack" style={{ maxWidth: 640, margin: '0 auto' }}>
      <Breadcrumbs
        items={[
          { label: 'Properties', href: '/properties' },
          { label: data.property.name, href: `/properties/${data.property.id}` },
          { label: 'Add unit' },
        ]}
      />

      <section className="card stack">
        <div>
          <div className="kicker">Property - {data.property.name}</div>
          <h2 style={{ margin: '4px 0 0' }}>Add a unit</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Add a rentable unit to this property. Tenant info is optional and can be updated later.
        </p>
        {capacity.freeTrial ? <div className="notice">Free trial: add your real portfolio without purchasing slots. Your first bill will be based on the active units present when you subscribe. <Link href="/account/subscription">See projected pricing</Link></div> : capacity.limit != null ? <div className="notice">You are using {capacity.activeUnits} of {capacity.limit} purchased unit slots. <Link href="/account/subscription">Increase unit capacity</Link></div> : null}
      </section>

      <section className="card stack">
        <NewUnitForm propertyId={id} />
      </section>
    </div>
  )
}
