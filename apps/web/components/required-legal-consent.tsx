import { PrivacyContent, TermsContent } from '@/components/legal-documents'
import { acceptCurrentTermsAction } from '@/app/legal/actions'
import type { LegalPrincipalType } from '@/lib/legal-consent'

const ROLE_LABELS: Record<LegalPrincipalType, string> = {
  manager: 'property manager',
  tenant: 'tenant',
  vendor: 'vendor',
  staff: 'maintenance staff member',
}

export function RequiredLegalConsent({ principalType, returnPath }: { principalType: LegalPrincipalType; returnPath: string }) {
  const roleLabel = ROLE_LABELS[principalType]
  return (
    <div className="legalModalBackdrop">
      <section className="legalModal" role="dialog" aria-modal="true" aria-labelledby="required-legal-title">
        <div className="legalModalHeader">
          <div className="kicker">Required before continuing</div>
          <h2 id="required-legal-title" style={{ margin: '4px 0 0' }}>Terms and privacy</h2>
          <p className="muted" style={{ margin: '6px 0 0' }}>Review the documents for your {roleLabel} access.</p>
        </div>
        <div className="legalModalBody stack">
          <details open><summary>Terms of Service</summary><TermsContent /></details>
          <details><summary>Privacy Policy</summary><PrivacyContent /></details>
        </div>
        <form action={acceptCurrentTermsAction} className="legalModalFooter stack" style={{ alignItems: 'stretch' }}>
          <input type="hidden" name="principalType" value={principalType} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <label className="row" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" name="acceptLegal" value="yes" required />
            <span>I agree to the Terms of Service and acknowledge the Privacy Policy as a {roleLabel}.</span>
          </label>
          <button type="submit" className="button primary">Accept and continue</button>
        </form>
      </section>
    </div>
  )
}
