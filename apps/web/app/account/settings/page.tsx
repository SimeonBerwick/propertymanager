import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { ANDROID_SUBSCRIPTION_MESSAGE, isAndroidWebView } from '@/lib/android-webview'
import { logout } from '@/lib/auth-actions'
import { CURRENCY_OPTIONS, currencyLabel } from '@/lib/types'
import { updateDefaultCurrencyAction } from './actions'

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ currency?: string }>
}) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const query = searchParams ? await searchParams : {}
  const androidApp = isAndroidWebView((await headers()).get('user-agent'))
  const account = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { defaultCurrency: true },
  })
  const defaultCurrency = account?.defaultCurrency ?? 'usd'

  return (
    <main className="stack">
      <section className="card stack">
        <div>
          <div className="kicker">Account</div>
          <h2 className="sectionTitle">Settings and support</h2>
          <div className="muted">Signed in as {session.email ?? 'property manager'}</div>
        </div>
        <form action={logout}>
          <button type="submit" className="button primary" style={{ alignSelf: 'flex-start' }}>Sign out</button>
        </form>
      </section>

      <section className="grid cols-2">
        <div className="card stack">
          <div>
            <div className="kicker">Plan</div>
            <h3 style={{ margin: '4px 0 0' }}>Subscription</h3>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {androidApp ? ANDROID_SUBSCRIPTION_MESSAGE : 'Review your current plan, billing status, and renewal details.'}
          </p>
          {!androidApp ? <Link href="/account/subscription" className="button primary" style={{ alignSelf: 'flex-start' }}>Subscription settings</Link> : null}
        </div>

        <div className="card stack">
          <div>
            <div className="kicker">Help</div>
            <h3 style={{ margin: '4px 0 0' }}>Support and feedback</h3>
          </div>
          <p className="muted" style={{ margin: 0 }}>Get login help, report a problem, or send product feedback.</p>
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <Link href="/support" className="button primary">Support</Link>
            <a className="button" href="mailto:support@simeonware.com?subject=Simeonware%20Maintenance%20Manager%20feedback">Send feedback</a>
          </div>
        </div>

        <div className="card stack">
          <div>
            <div className="kicker">Billing currency</div>
            <h3 style={{ margin: '4px 0 0' }}>Default request currency</h3>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            New work orders default to {currencyLabel(defaultCurrency)}. Existing requests keep the currency they were created with.
          </p>
          {query.currency === 'updated' ? <div className="notice success">Default currency updated.</div> : null}
          {query.currency === 'invalid' ? <div className="notice error">Choose a valid billing currency.</div> : null}
          <form action={updateDefaultCurrencyAction} className="row" style={{ justifyContent: 'flex-start', alignItems: 'flex-end' }}>
            <label className="field" style={{ minWidth: 220 }}>
              <span className="field-label">Currency</span>
              <select className="input" name="defaultCurrency" defaultValue={defaultCurrency}>
                {CURRENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <button type="submit" className="button primary">Save currency</button>
          </form>
        </div>

        <div className="card stack">
          <div>
            <div className="kicker">Privacy</div>
            <h3 style={{ margin: '4px 0 0' }}>Data and account</h3>
          </div>
          <p className="muted" style={{ margin: 0 }}>Review privacy practices or submit an in-app request to delete your account and associated data.</p>
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <Link href="/privacy" className="button">Privacy policy</Link>
            <Link href="/account/settings/deletion" className="button primary">Delete account and data</Link>
          </div>
        </div>

        <div className="card stack">
          <div>
            <div className="kicker">Legal</div>
            <h3 style={{ margin: '4px 0 0' }}>Terms</h3>
          </div>
          <p className="muted" style={{ margin: 0 }}>Review the terms governing use of Simeonware: Maintenance Manager.</p>
          <Link href="/terms" className="button" style={{ alignSelf: 'flex-start' }}>Terms of service</Link>
        </div>
      </section>
    </main>
  )
}
