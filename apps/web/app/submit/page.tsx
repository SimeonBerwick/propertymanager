import { redirect } from 'next/navigation'
import { getAllUnits, getProperties } from '@/lib/data'
import { prisma } from '@/lib/prisma'
import { SubmitRequestForm } from './submit-request-form'
import { IntakeDraftCleanup } from '@/components/intake-draft-cleanup'
import { getLandlordSession } from '@/lib/landlord-session'
import type { CurrencyOption, LanguageOption } from '@/lib/types'
import { savedLanguagePreference } from '@/lib/localization-server'
import { planIncludesLocalization } from '@/lib/localization-entitlement'

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

  if (!isManagerMode) {
    return (
      <div className="stack" style={{ maxWidth: 640, margin: '0 auto' }}>
        <section className="card stack">
          <div>
            <div className="kicker">Maintenance request</div>
            <h1 className="pageTitle">Use your property's request link</h1>
          </div>
          <p className="muted">For privacy, each property manager has a separate maintenance form. Open the link your property manager shared, or sign in to your tenant portal.</p>
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <a className="button primary" href="/mobile/auth/login">Tenant sign in</a>
            <a className="button" href="/support">Get help</a>
          </div>
        </section>
      </div>
    )
  }
  if (!session) redirect('/login?error=session-expired')

  const [properties, units] = await Promise.all([
    getProperties(session.userId),
    getAllUnits(session.userId),
  ])
  const accountDefaults = session
    ? await prisma.user.findUnique({ where: { id: session.userId }, select: { defaultCurrency: true, preferredLanguage: true, subscriptionPlan: true } })
    : null
  const defaultCurrency: CurrencyOption = session
    ? accountDefaults?.defaultCurrency ?? 'usd'
    : 'usd'
  const defaultLanguage: LanguageOption = accountDefaults
    ? planIncludesLocalization(accountDefaults.subscriptionPlan) ? accountDefaults.preferredLanguage : 'english'
    : await savedLanguagePreference() ?? 'english'

  if (submitted) {
    return (
      <div className="stack" style={{ maxWidth: 840, margin: '0 auto' }}>
        <IntakeDraftCleanup managerDraftScope={session?.userId} />
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
        <SubmitRequestForm properties={properties} units={units} managerMode={isManagerMode} managerDraftScope={session?.userId} defaultCurrency={defaultCurrency} defaultLanguage={defaultLanguage} />
      </section>
    </div>
  )
}
