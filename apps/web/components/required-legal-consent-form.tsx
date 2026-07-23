'use client'

import { useEffect, useState } from 'react'
import { acceptCurrentTermsAction } from '@/app/legal/actions'
import type { LegalPrincipalType } from '@/lib/legal-consent'

export function RequiredLegalConsentForm({
  principalType,
  returnPath,
  roleLabel,
}: {
  principalType: LegalPrincipalType
  returnPath: string
  roleLabel: string
}) {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <form action={acceptCurrentTermsAction} className="legalModalFooter stack" style={{ alignItems: 'stretch' }}>
      <input type="hidden" name="principalType" value={principalType} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <label className="row" style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" name="acceptLegal" value="yes" required />
        <span>I agree to the Terms of Service and acknowledge the Privacy Policy as a {roleLabel}.</span>
      </label>
      <button type="submit" className="button primary" disabled={!hydrated}>Accept and continue</button>
    </form>
  )
}
