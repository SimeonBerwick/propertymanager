import { notFound } from 'next/navigation'
import { getAllUnits, getLandlordBySlug, getProperties } from '@/lib/data'
import { SubmitRequestForm } from '../submit-request-form'

export default async function ScopedSubmitPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<{ submitted?: string }>
}) {
  const { orgSlug } = await params
  const { submitted } = await searchParams

  const landlord = await getLandlordBySlug(orgSlug)
  if (!landlord) notFound()

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
          <a href={`/submit/${orgSlug}`} className="button" style={{ alignSelf: 'flex-start' }}>
            Submit another request
          </a>
        </section>
      </div>
    )
  }

  const [properties, units] = await Promise.all([
    getProperties(undefined, orgSlug),
    getAllUnits(undefined, orgSlug),
  ])

  return (
    <div className="stack" style={{ maxWidth: 840, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">Submit a request</div>
          <h2 style={{ margin: '4px 0 0' }}>Report a maintenance issue</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Fill out this form to report an issue in your unit. Include as much detail as possible so we can respond
          quickly.
        </p>
      </section>

      <section className="card stack">
        <SubmitRequestForm properties={properties} units={units} orgSlug={orgSlug} />
      </section>
    </div>
  )
}
