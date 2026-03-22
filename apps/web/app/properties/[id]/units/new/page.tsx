import { notFound } from 'next/navigation'
import { getPropertyDetailData } from '@/lib/data'
import { NewUnitForm } from './new-unit-form'

export default async function NewUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getPropertyDetailData(id)

  if (!data) {
    notFound()
  }

  return (
    <div className="stack" style={{ maxWidth: 640, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">Property · {data.property.name}</div>
          <h2 style={{ margin: '4px 0 0' }}>Add a unit</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Add a rentable unit to this property. Tenant info is optional and can be updated later.
        </p>
      </section>

      <section className="card stack">
        <NewUnitForm propertyId={id} />
      </section>
    </div>
  )
}
