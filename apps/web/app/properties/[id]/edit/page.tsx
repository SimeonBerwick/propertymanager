import { notFound, redirect } from 'next/navigation'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { getPropertyDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { EditPropertyForm } from './edit-property-form'

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')

  const { id } = await params
  const data = await getPropertyDetailData(id, session.userId)

  if (!data) {
    notFound()
  }

  return (
    <div className="stack" style={{ maxWidth: 640, margin: '0 auto' }}>
      <Breadcrumbs
        items={[
          { label: 'Properties', href: '/properties' },
          { label: data.property.name, href: `/properties/${data.property.id}` },
          { label: 'Edit property' },
        ]}
      />

      <section className="card stack">
        <div>
          <div className="kicker">Properties</div>
          <h2 style={{ margin: '4px 0 0' }}>Edit property</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Update the property name and address. Units and request history stay attached.
        </p>
      </section>

      <section className="card stack">
        <EditPropertyForm
          propertyId={data.property.id}
          initialName={data.property.name}
          initialAddress={data.property.address}
        />
      </section>
    </div>
  )
}
