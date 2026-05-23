import { redirect } from 'next/navigation'
import { getAllUnits, getProperties } from '@/lib/data'
import { prisma } from '@/lib/prisma'
import { SubmitRequestForm } from './submit-request-form'

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>
}) {
  const { submitted } = await searchParams

  // Redirect to the scoped submit URL when exactly one landlord has a slug configured.
  // This is the common single-landlord deployment case and gives tenants a properly
  // scoped form without requiring them to know the /submit/[orgSlug] URL directly.
  try {
    const sluggedUsers = await prisma.user.findMany({
      where: { slug: { not: null } },
      select: { slug: true },
    })
    if (sluggedUsers.length === 1 && sluggedUsers[0].slug) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      redirect(`/submit/${sluggedUsers[0].slug}${submitted ? `?submitted=${submitted}` : ''}` as any)
    }
  } catch {
    // DB unavailable — fall through to the unscoped form below.
  }

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
            Your request is in. The property manager has been notified.
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
          Report the issue and add photos if needed.
        </p>
      </section>

      <section className="card stack">
        <SubmitRequestForm properties={properties} units={units} />
      </section>
    </div>
  )
}
