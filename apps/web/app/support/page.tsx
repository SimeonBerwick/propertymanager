export const metadata = {
  title: 'Support | Simeonware: Maintenance Manager',
  description: 'Support and feedback for Simeonware: Maintenance Manager.',
}

export default function SupportPage() {
  return (
    <main className="stack" style={{ maxWidth: 760, margin: '0 auto' }}>
      <section className="card stack">
        <div>
          <div className="kicker">Simeonware LLC</div>
          <h2 className="sectionTitle">Support and feedback</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          For login help, product questions, pilot feedback, or a problem with a maintenance workflow, email support@simeonware.com.
        </p>
        <a className="button primary" style={{ alignSelf: 'flex-start' }} href="mailto:support@simeonware.com?subject=Simeonware%20Maintenance%20Manager%20support">
          Email support
        </a>
      </section>
    </main>
  )
}
