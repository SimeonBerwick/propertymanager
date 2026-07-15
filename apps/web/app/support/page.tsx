export const metadata = {
  title: 'Support | Simeonware',
  description: 'Get help with Simeonware account access and property maintenance workflows.',
}

import { SupportForm } from './support-form'
import { getRecentSupportRequests } from './actions'

export default async function SupportPage({ searchParams }: { searchParams?: Promise<{ errorReference?: string }> }) {
  const params = searchParams ? await searchParams : undefined
  const recent = await getRecentSupportRequests().catch(() => [])
  return (
    <main className="stack" style={{ maxWidth: 760, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">We are here to help</div>
          <h1 className="pageTitle">Simeonware support</h1>
        </div>
        <p className="muted" style={{ margin: 0 }}>Send the details here. Simeonware saves the request, alerts support, and gives you a reference that can be followed through resolution.</p>
        <SupportForm errorReference={params?.errorReference} />
        <p className="muted" style={{ margin: 0 }}>
          You can also email <a href="mailto:support@simeonware.com?subject=Simeonware%20support%20request">support@simeonware.com</a>. Include your support reference when following up.
        </p>
      </section>
      {recent.length ? (
        <section className="stack">
          <div className="sectionHead"><div><h2 className="sectionTitle">Recent support requests</h2><p className="muted sectionSubtitle">References and current status for this signed-in account.</p></div></div>
          <div className="tableWrap"><table><thead><tr><th>Reference</th><th>Topic</th><th>Submitted</th><th>Status</th></tr></thead><tbody>{recent.map((request) => <tr key={request.referenceId}><td><strong>{request.referenceId}</strong></td><td>{request.category.replaceAll('_', ' ')}</td><td>{request.createdAt.toLocaleDateString()}</td><td>{request.status.replaceAll('_', ' ')}</td></tr>)}</tbody></table></div>
        </section>
      ) : null}
    </main>
  )
}
