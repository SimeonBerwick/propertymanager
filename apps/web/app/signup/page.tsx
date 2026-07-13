import { headers } from 'next/headers'
import { SignupForm } from './signup-form'
import { isAndroidWebView } from '@/lib/android-webview'
import { parseCadence, parsePlan } from '@/lib/billing-plans'

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ plan?: string; cadence?: string }>
}) {
  const androidApp = isAndroidWebView((await headers()).get('user-agent'))
  const query = await searchParams
  const initialPlan = parsePlan(query?.plan ?? null) ?? 'starter'
  const initialCadence = parseCadence(query?.cadence ?? null) ?? 'monthly'

  if (androidApp) {
    return (
      <main className="stack" style={{ maxWidth: 900, margin: '0 auto' }}>
        <section className="card stack">
          <div>
            <div className="kicker">Free month</div>
            <h2 style={{ margin: '4px 0 0' }}>Create your property manager account</h2>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Start your free month in the app. For subscription details and plan information, visit simeonware.com in a web browser.
          </p>
        </section>

        <section className="card stack">
          <SignupForm androidApp initialPlan={initialPlan} initialCadence={initialCadence} />
        </section>
      </main>
    )
  }

  return (
    <main className="stack" style={{ maxWidth: 900, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">30-day free trial</div>
          <h2 style={{ margin: '4px 0 0' }}>Create your property manager account</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Choose the plan that fits today. Every plan includes the complete maintenance workflow, and no credit card is required to start.
        </p>
      </section>

      <section className="card stack">
        <SignupForm initialPlan={initialPlan} initialCadence={initialCadence} />
      </section>
    </main>
  )
}
