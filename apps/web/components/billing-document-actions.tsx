'use client'

import { useActionState } from 'react'
import type React from 'react'
import {
  resendBillingDocumentAction,
  duplicateBillingDocumentAction,
  voidBillingDocumentAction,
  type BillingActionState,
} from '@/lib/billing-actions'
import { billingStatusLabel } from '@/lib/billing-utils'

const INITIAL_STATE: BillingActionState = { error: null }

function confirmVoid(event: React.MouseEvent<HTMLButtonElement>) {
  if (!window.confirm('Void this billing document? This removes it from active totals and blocks resend.')) {
    event.preventDefault()
  }
}

export function BillingDocumentActions({
  billingDocumentId,
  requestId,
  status,
}: {
  billingDocumentId: string
  requestId: string
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'void'
}) {
  const [resendState, resendAction, resendPending] = useActionState(resendBillingDocumentAction, INITIAL_STATE)
  const [duplicateState, duplicateAction, duplicatePending] = useActionState(duplicateBillingDocumentAction, INITIAL_STATE)
  const [voidState, voidAction, voidPending] = useActionState(voidBillingDocumentAction, INITIAL_STATE)

  return (
    <div className="billingActionsRow">
      <form action={resendAction}>
        <input type="hidden" name="billingDocumentId" value={billingDocumentId} />
        <input type="hidden" name="requestId" value={requestId} />
        <button type="submit" className="button">{resendPending ? 'Sending…' : 'Resend'}</button>
      </form>
      <form action={duplicateAction}>
        <input type="hidden" name="billingDocumentId" value={billingDocumentId} />
        <input type="hidden" name="requestId" value={requestId} />
        <button
          type="submit"
          className="button"
          title="Creates a draft copy with no recipient, no sent timestamp, and no payment recorded."
        >
          {duplicatePending ? 'Duplicating…' : 'Duplicate as draft'}
        </button>
      </form>
      <form action={voidAction}>
        <input type="hidden" name="billingDocumentId" value={billingDocumentId} />
        <input type="hidden" name="requestId" value={requestId} />
        <button
          type="submit"
          className="button"
          title={`Current status: ${billingStatusLabel(status)}`}
          onClick={confirmVoid}
        >
          {voidPending ? 'Voiding…' : 'Void'}
        </button>
      </form>
      {resendState.error ? <div className="notice error">{resendState.error}</div> : null}
      {duplicateState.error ? <div className="notice error">{duplicateState.error}</div> : null}
      {voidState.error ? <div className="notice error">{voidState.error}</div> : null}
    </div>
  )
}
