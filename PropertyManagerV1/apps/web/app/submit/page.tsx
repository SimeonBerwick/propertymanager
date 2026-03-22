import { getAllUnits, getProperties } from '@/lib/data'
import { SubmitRequestForm } from './submit-request-form'

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>
}) {
  const { submitted } = await searchParams
  const [properties, units] = await Promise.all([getProperties(), getAllUnits()])

  return (
    <div className="stack" style={{ maxWidth: 840, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">Tenant issue submission</div>
          <h2 style={{ margin: '4px 0 0' }}>Report a maintenance issue</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Use this form to send a new issue into the maintenance queue with property, unit, urgency, details, and photos.
        </p>
      </section>

      {submitted && (
        <section className="notice success">
          Request submitted. Reference ID: <strong>{submitted}</strong>
        </section>
      )}

      <section className="card stack">
        <SubmitRequestForm properties={properties} units={units} />
      </section>
    </div>
  )
}
