import { AssistedTrialContent, TermsContent } from '@/components/legal-documents'

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
          <div className="muted sectionSubtitle">Effective July 20, 2026</div>
        </div>
        <TermsContent />
      </section>
      <section className="card stack" id="assisted-trial">
        <div>
          <div className="kicker">Invited U.S. customers</div>
          <h2 className="sectionTitle">30-Day Assisted Trial Agreement</h2>
        </div>
        <AssistedTrialContent />
      </section>
    </main>
  )
}
