import { PrivacyContent } from '@/components/legal-documents'

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
          <div className="muted sectionSubtitle">Effective July 20, 2026</div>
        </div>
        <PrivacyContent />
      </section>
    </main>
  )
}
