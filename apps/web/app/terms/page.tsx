export const metadata = {
  title: 'Terms of Service | Simeonware: Maintenance Manager',
  description: 'Terms of service for Simeonware: Maintenance Manager.',
}

export default function TermsPage() {
  return (
    <main className="stack" style={{ maxWidth: 920, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">Legal</div>
          <h2 className="sectionTitle">Terms of Service</h2>
          <div className="muted sectionSubtitle">Last updated: June 5, 2026</div>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          These terms govern use of Simeonware: Maintenance Manager, a maintenance coordination service operated by Simeonware LLC for landlords, property managers, tenants, and vendors.
        </p>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Use of the service</h3>
        <p className="muted" style={{ margin: 0 }}>
          You may use the service to submit, manage, track, communicate about, and report on property maintenance requests. You are responsible for the accuracy of information you provide and for keeping account access secure.
        </p>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Accounts and access</h3>
        <p className="muted" style={{ margin: 0 }}>
          Property manager accounts control property, unit, tenant, vendor, and request records. Tenant and vendor access is limited to the workflows made available to them. You must not use the service to access information you are not authorized to view.
        </p>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Subscriptions and payment</h3>
        <p className="muted" style={{ margin: 0 }}>
          New property manager accounts may receive a free trial. Paid subscriptions, billing cadence, renewal, cancellation, and payment processing are handled through the billing flow made available in the product. Payment processing is provided by Stripe when enabled.
        </p>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Maintenance coordination</h3>
        <p className="muted" style={{ margin: 0 }}>
          The service helps coordinate maintenance work but does not itself provide repair services, emergency services, property management services, legal advice, or vendor guarantees. Property managers remain responsible for compliance, tenant communications, vendor selection, payment decisions, and emergency handling.
        </p>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Acceptable use</h3>
        <p className="muted" style={{ margin: 0 }}>
          You may not misuse the service, interfere with its operation, upload unlawful or harmful content, attempt unauthorized access, or use the service in a way that violates applicable law or another party's rights.
        </p>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Availability and changes</h3>
        <p className="muted" style={{ margin: 0 }}>
          The service may change over time and may occasionally be unavailable due to maintenance, outages, provider issues, or other operational needs. We may update these terms as the product, provider setup, or legal structure changes.
        </p>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Contact</h3>
        <p className="muted" style={{ margin: 0 }}>
          Questions about these terms can be sent to support@simeonware.com.
        </p>
      </section>
    </main>
  )
}
