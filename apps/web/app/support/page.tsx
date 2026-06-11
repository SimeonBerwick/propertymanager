export const metadata = {
  title: 'Support | Simeonware',
  description: 'Get help with Simeonware account access and property maintenance workflows.',
}

export default function SupportPage() {
  return (
    <main className="stack" style={{ maxWidth: 760, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">We are here to help</div>
          <h1 className="pageTitle">Simeonware support</h1>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Get help with account access, product questions, or a maintenance workflow. Email support@simeonware.com and include your organization name and a brief description of the issue.
        </p>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <a className="button primary" href="mailto:support@simeonware.com?subject=Simeonware%20Maintenance%20Manager%20support">
            Email support
          </a>
          <a className="button" href="mailto:support@simeonware.com?subject=Simeonware%20Maintenance%20Manager%20feedback">
            Share product feedback
          </a>
        </div>
      </section>
    </main>
  )
}
