export const metadata = {
  title: 'Privacy Policy | Simeonware: Maintenance Manager',
  description: 'Privacy policy for Simeonware: Maintenance Manager.',
}

export default function PrivacyPage() {
  return (
    <main className="stack" style={{ maxWidth: 920, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">Legal</div>
          <h2 className="sectionTitle">Privacy Policy</h2>
          <div className="muted sectionSubtitle">Last updated: July 12, 2026</div>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Simeonware LLC operates Simeonware: Maintenance Manager, which helps property managers, tenants, maintenance staff, and vendors coordinate maintenance work. This policy explains what information the service handles and how it is used.
        </p>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Information we collect</h3>
        <p className="muted" style={{ margin: 0 }}>
          We collect account and contact information such as names, email addresses, phone numbers, property or unit details, tenant access information, vendor and maintenance-staff details, maintenance request descriptions, status updates, comments, photos, files, inspection and unit-turn records, schedules, billing records, and operational audit events.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          When connected by a property manager, the service may access mailbox information to send maintenance updates and sync related replies, access an Outlook calendar to list available calendars and publish maintenance events, and exchange approved accounting records and payment status with QuickBooks Online. We store connection identifiers, authorization credentials, synchronization status, and the records needed to provide those integrations. Payment processing is handled by Stripe when subscriptions are enabled. Android push notifications use device identifiers supplied through Firebase Cloud Messaging.
        </p>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>How we use information</h3>
        <p className="muted" style={{ margin: 0 }}>
          We use information to operate the maintenance workflow, route requests, coordinate vendors and staff, schedule work, run inspections and unit turns, notify users, manage access, keep request history, synchronize connected services, generate operational reports, process subscriptions, prevent abuse, and improve reliability.
        </p>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Sharing and service providers</h3>
        <p className="muted" style={{ margin: 0 }}>
          We do not sell personal information. We share information with service providers only as needed to run the product, including hosting, database, private storage, email delivery, authentication, rate limiting, push notification, analytics or logging, payment processing, calendar, mailbox, and accounting-integration providers. Information is also shared with invited property managers, tenants, maintenance staff, and vendors when that sharing is part of the maintenance workflow.
        </p>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Data retention and security</h3>
        <p className="muted" style={{ margin: 0 }}>
          Maintenance records are retained while an account is active and as needed for operational, legal, accounting, and security purposes. We use reasonable technical and organizational safeguards, including private media storage and authenticated access controls.
        </p>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Your choices</h3>
        <p className="muted" style={{ margin: 0 }}>
          Property managers may disconnect optional mailbox, calendar, and accounting integrations from their settings. You may request access, correction, or deletion of account information through our account deletion page or by contacting support. Some records may need to be retained where required for legitimate business, legal, security, or accounting reasons.
        </p>
      </section>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Contact</h3>
        <p className="muted" style={{ margin: 0 }}>
          Questions about this policy can be sent to support@simeonware.com.
        </p>
      </section>
    </main>
  )
}
