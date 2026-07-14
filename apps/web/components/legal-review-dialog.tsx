'use client'

import { useState } from 'react'
import { AssistedTrialContent, PrivacyContent, TermsContent } from '@/components/legal-documents'

export function LegalReviewDialog({ assistedTrial = false, onReviewed }: { assistedTrial?: boolean; onReviewed?: () => void }) {
  const [open, setOpen] = useState(false)
  const finishReview = () => { setOpen(false); onReviewed?.() }
  return (
    <>
      <button type="button" className="button" onClick={() => setOpen(true)}>Review legal documents</button>
      {open ? (
        <div className="legalModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) finishReview() }}>
          <section className="legalModal" role="dialog" aria-modal="true" aria-labelledby="legal-review-title">
            <div className="row legalModalHeader">
              <div>
                <div className="kicker">Legal review</div>
                <h2 id="legal-review-title" style={{ margin: '4px 0 0' }}>Terms and privacy</h2>
              </div>
              <button type="button" className="button" aria-label="Close legal documents" onClick={finishReview}>Close</button>
            </div>
            <div className="legalModalBody stack">
              <details open>
                <summary>Terms of Service</summary>
                <TermsContent />
              </details>
              {assistedTrial ? (
                <details>
                  <summary>30-Day Assisted Trial Agreement</summary>
                  <AssistedTrialContent />
                </details>
              ) : null}
              <details>
                <summary>Privacy Policy</summary>
                <PrivacyContent />
              </details>
            </div>
            <div className="legalModalFooter">
              <button type="button" className="button primary" onClick={finishReview}>Done reviewing</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
