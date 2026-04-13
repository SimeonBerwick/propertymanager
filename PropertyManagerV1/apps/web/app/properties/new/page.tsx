import { Breadcrumbs } from '@/components/breadcrumbs'
import { NewPropertyForm } from './new-property-form'

export default function NewPropertyPage() {
  return (
    <div className="stack" style={{ maxWidth: 640, margin: '0 auto' }}>
      <Breadcrumbs items={[{ label: 'Properties', href: '/properties' }, { label: 'Add property' }]} />

      <section className="card stack">
        <div>
          <div className="kicker">Properties</div>
          <h2 style={{ margin: '4px 0 0' }}>Add a property</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Enter the property name and address. You can add units after the property is created.
        </p>
      </section>

      <section className="card stack">
        <NewPropertyForm />
      </section>
    </div>
  )
}
