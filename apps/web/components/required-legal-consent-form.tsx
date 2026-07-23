'use client'

import { useActionState, useEffect, useState } from 'react'
import { acceptCurrentTermsAction, type CurrentTermsActionState } from '@/app/legal/actions'
import type { LegalPrincipalType } from '@/lib/legal-consent'

const INITIAL_STATE: CurrentTermsActionState = { error: null }

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
  const [state, formAction, pending] = useActionState(acceptCurrentTermsAction, INITIAL_STATE)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (state.success) window.location.replace(returnPath)
  }, [returnPath, state.success])

  return (
    <form action={formAction} className="legalModalFooter stack" style={{ alignItems: 'stretch' }}>
      <input type="hidden" name="principalType" value={principalType} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <label className="row" style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" name="acceptLegal" value="yes" required />
        <span>I agree to the Terms of Service and acknowledge the Privacy Policy as a {roleLabel}.</span>
      </label>
      {state.error ? <div className="notice error" role="alert">{state.error}</div> : null}
      <button type="submit" className="button primary" disabled={!hydrated || pending}>
        {pending ? 'Saving acceptance...' : 'Accept and continue'}
      </button>
    </form>
  )
}
