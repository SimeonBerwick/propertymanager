import { getAllUnits, getProperties } from '@/lib/data'
import { SubmitRequestForm } from './submit-request-form'

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>
}) {
  const { submitted } = await searchParams
  const [properties, units] = await Promise.all([getProperties(), getAllUnits()])

  if (submitted) {
    return (
      <div className="stack" style={{ maxWidth: 840, margin: '0 auto' }}>
        <section className="card stack">
          <div>
            <div className="kicker">Submit a request</div>
            <h2 style={{ margin: '4px 0 0' }}>Request received</h2>
          </div>
          <p style={{ margin: 0 }}>
            Your maintenance request has been submitted. The property manager has been notified and will be in touch.
          </p>
          <a href="/submit" className="button" style={{ alignSelf: 'flex-start' }}>Submit another request</a>
        </section>
      </div>
    )
  }

  return (
    <div className="stack" style={{ maxWidth: 840, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">Submit a request</div>
          <h2 style={{ margin: '4px 0 0' }}>Report a maintenance issue</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Fill out this form to report an issue in your unit. Include as much detail as possible so we can respond quickly.
        </p>
      </section>

      <section className="card stack">
        <SubmitRequestForm properties={properties} units={units} />
      </section>
    </div>
  )
}
