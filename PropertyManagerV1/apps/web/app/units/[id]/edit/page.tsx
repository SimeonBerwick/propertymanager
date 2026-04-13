import { notFound, redirect } from 'next/navigation'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { getUnitDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { EditUnitForm } from './edit-unit-form'
import { DangerZoneForm } from '@/components/danger-zone-form'
import { deleteUnitAction } from '@/lib/property-actions'

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
      <Breadcrumbs
        items={[
          { label: 'Properties', href: '/properties' },
          { label: data.property.name, href: `/properties/${data.property.id}` },
          { label: data.unit.label, href: `/units/${data.unit.id}` },
          { label: 'Edit unit' },
        ]}
      />

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

      <section className="card stack">
        <DangerZoneForm
          action={deleteUnitAction}
          hiddenFields={[
            { name: 'unitId', value: data.unit.id },
            { name: 'propertyId', value: data.property.id },
            { name: 'unitLabel', value: data.unit.label },
          ]}
          title="Delete unit"
          description={
            <>
              Only units with no maintenance history and no tenant identity records can be deleted. Type <strong>{data.unit.label}</strong> to confirm.
            </>
          }
          confirmationLabel="Confirm unit label"
          confirmationValue={data.unit.label}
          submitLabel="Delete unit"
        />
      </section>
    </div>
  )
}
