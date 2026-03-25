import { getAllUnits, getProperties } from '@/lib/data'
import { SubmitRequestForm } from './submit-request-form'

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>
}) {
  const { submitted } = await searchParams
  // NOTE (product-level limitation): this public form loads ALL properties/units from the DB
  // with no owner scoping because tenants are unauthenticated and there is no org-code or
  // public-slug on the URL to identify a specific landlord. In a multi-landlord deployment
  // this means one landlord's tenants can see another landlord's property names in the
  // dropdown. To fully scope this, add a per-landlord public slug (e.g. /submit/[orgSlug])
  // and pass it as a filter to getProperties/getAllUnits. Until then, seed-data fallback on
  // DB failure has been removed — the form will show an empty dropdown rather than demo records.
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
