import { notFound, redirect } from 'next/navigation'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { getPropertyDetailData } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'
import { EditPropertyForm } from './edit-property-form'
import { DangerZoneForm } from '@/components/danger-zone-form'
import { StateToggleForm } from '@/components/state-toggle-form'
import { archivePropertyAction, deletePropertyAction, restorePropertyAction } from '@/lib/property-actions'

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

      <section className="card stack">
        <div>
          <div className="kicker">Lifecycle</div>
          <h3 style={{ margin: '4px 0 0' }}>{data.property.isActive ? 'Archive property' : 'Restore property'}</h3>
        </div>
        {data.property.isActive ? (
          <StateToggleForm
            action={archivePropertyAction}
            hiddenFields={[{ name: 'propertyId', value: data.property.id }]}
            submitLabel="Archive property"
            tone="warn"
            helperText="Archived properties leave the active roster. Their units are archived with them, and history stays intact."
          />
        ) : (
          <StateToggleForm
            action={restorePropertyAction}
            hiddenFields={[{ name: 'propertyId', value: data.property.id }]}
            submitLabel="Restore property"
            helperText="Restoring a property puts it back into active operations. Units stay in their current state so you can reactivate selectively."
          />
        )}
      </section>

      <section className="card stack">
        <DangerZoneForm
          action={deletePropertyAction}
          hiddenFields={[
            { name: 'propertyId', value: data.property.id },
            { name: 'propertyName', value: data.property.name },
          ]}
          title="Delete property"
          description={
            <>
              Only empty properties can be deleted. If this property has units, tenant identities, or maintenance history,
              deletion is blocked. Type <strong>{data.property.name}</strong> to confirm.
            </>
          }
          confirmationLabel="Confirm property name"
          confirmationValue={data.property.name}
          submitLabel="Delete property"
        />
      </section>
    </div>
  )
}
