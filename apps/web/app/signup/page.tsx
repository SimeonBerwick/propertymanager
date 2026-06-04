import { SignupForm } from './signup-form'

export default function SignupPage() {
  return (
    <main className="stack" style={{ maxWidth: 900, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">Property Manager V1</div>
          <h2 style={{ margin: '4px 0 0' }}>Start your free month</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Choose Growth or Pro now. You can use the app for the first month without a card, or enter a promo code for an extended feedback trial.
        </p>
      </section>

      <section className="card stack">
        <SignupForm />
      </section>
    </main>
  )
}
