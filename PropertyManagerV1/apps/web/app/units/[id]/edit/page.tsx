import { notFound, redirect } from 'next/navigation'
import { getUnitDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { EditUnitForm } from './edit-unit-form'

export default async function EditUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')

  const { id } = await params
  const data = await getUnitDetailData(id, session.userId)

  if (!data) {
    notFound()
  }

  return (
    <div className="stack" style={{ maxWidth: 640, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">Units</div>
          <h2 style={{ margin: '4px 0 0' }}>Edit unit</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Update the unit label and tenant contact data without touching its maintenance history.
        </p>
      </section>

      <section className="card stack">
        <EditUnitForm
          unitId={data.unit.id}
          propertyId={data.property.id}
          initialLabel={data.unit.label}
          initialTenantName={data.unit.tenantName}
          initialTenantEmail={data.unit.tenantEmail}
        />
      </section>
    </div>
  )
}
