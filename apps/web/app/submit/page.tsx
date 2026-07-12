import { redirect } from 'next/navigation'
import { getAllUnits, getProperties } from '@/lib/data'
import { prisma } from '@/lib/prisma'
import { SubmitRequestForm } from './submit-request-form'
import { IntakeDraftCleanup } from '@/components/intake-draft-cleanup'
import { getLandlordSession } from '@/lib/landlord-session'
import type { CurrencyOption } from '@/lib/types'

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; mode?: string }>
}) {
  const { submitted, mode } = await searchParams
  const landlordSession = await getLandlordSession()
  const isManagerMode = mode === 'manager' || Boolean(landlordSession)
  const session = isManagerMode ? landlordSession : null
  if (mode === 'manager' && !session) redirect('/login?error=session-expired')

  // Redirect to the scoped submit URL when exactly one landlord has a slug configured.
  // This is the common single-landlord deployment case and gives tenants a properly
  // scoped form without requiring them to know the /submit/[orgSlug] URL directly.
  try {
    const sluggedUsers = await prisma.user.findMany({
      where: { slug: { not: null } },
      select: { slug: true },
    })
    if (!isManagerMode && sluggedUsers.length === 1 && sluggedUsers[0].slug) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      redirect(`/submit/${sluggedUsers[0].slug}${submitted ? `?submitted=${submitted}` : ''}` as any)
    }
  } catch {
    // DB unavailable — fall through to the unscoped form below.
  }

  const [properties, units] = await Promise.all([
    getProperties(session?.userId),
    getAllUnits(session?.userId),
  ])
  const defaultCurrency: CurrencyOption = session
    ? (await prisma.user.findUnique({ where: { id: session.userId }, select: { defaultCurrency: true } }))?.defaultCurrency ?? 'usd'
    : 'usd'

  if (submitted) {
    return (
      <div className="stack" style={{ maxWidth: 840, margin: '0 auto' }}>
        <IntakeDraftCleanup />
        <section className="card stack">
          <div>
            <div className="kicker">{isManagerMode ? 'Create work order' : 'Submit a request'}</div>
            <h2 style={{ margin: '4px 0 0' }}>{isManagerMode ? 'Work order created' : 'Request received'}</h2>
          </div>
          <p style={{ margin: 0 }}>
            {isManagerMode ? 'The work order is ready on your dashboard.' : 'Your request is in. The property manager has been notified.'}
          </p>
          <a href={isManagerMode ? '/submit?mode=manager' : '/submit'} className="button" style={{ alignSelf: 'flex-start' }}>
            {isManagerMode ? 'Create another work order' : 'Submit another request'}
          </a>
        </section>
      </div>
    )
  }

  return (
    <div className="stack" style={{ maxWidth: 840, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">{isManagerMode ? 'Create work order' : 'Submit a request'}</div>
          <h2 style={{ margin: '4px 0 0' }}>{isManagerMode ? 'Create work order' : 'Report a maintenance issue'}</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {isManagerMode ? 'Log a repair for a residential unit or property area and add photos if needed.' : 'Report the issue and add photos if needed.'}
        </p>
      </section>

      <section className="card stack">
        <SubmitRequestForm properties={properties} units={units} managerMode={isManagerMode} defaultCurrency={defaultCurrency} />
      </section>
    </div>
  )
}
