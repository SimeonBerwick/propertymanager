import { headers } from 'next/headers'
import Link from 'next/link'
import { SignupForm } from './signup-form'
import { ANDROID_SUBSCRIPTION_MESSAGE, isAndroidWebView } from '@/lib/android-webview'

export default async function SignupPage() {
  const androidApp = isAndroidWebView((await headers()).get('user-agent'))

  if (androidApp) {
    return (
      <main className="stack" style={{ maxWidth: 900, margin: '0 auto' }}>
        <section className="card stack">
          <div>
            <div className="kicker">Simeonware LLC</div>
            <h2 style={{ margin: '4px 0 0' }}>Account access</h2>
          </div>
          <p className="muted" style={{ margin: 0 }}>{ANDROID_SUBSCRIPTION_MESSAGE}</p>
          <Link href="/login" className="button primary" style={{ alignSelf: 'flex-start' }}>Sign in</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="stack" style={{ maxWidth: 900, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">Simeonware LLC</div>
          <h2 style={{ margin: '4px 0 0' }}>Start your free month</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Choose Growth, Pro, or Portfolio now. You can use the app for the first month without a card, or enter a promo code for an extended feedback trial.
        </p>
      </section>

      <section className="card stack">
        <SignupForm />
      </section>
    </main>
  )
}
