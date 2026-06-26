'use client'

import { useActionState } from 'react'
import { chooseVendorAccountAction, type VendorAccountChoiceState } from './actions'
import type { VendorAccountOption } from '@/lib/vendor-portal-data'

const INITIAL_STATE: VendorAccountChoiceState = { error: null }

export function VendorAccountChooser({
  identifier,
  next,
  accounts,
}: {
  identifier: string
  next?: string
  accounts: VendorAccountOption[]
}) {
  const [state, formAction, pending] = useActionState(chooseVendorAccountAction, INITIAL_STATE)

  return (
    <div className="stack">
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {accounts.map((account) => (
        <form key={account.vendorId} action={formAction}>
          <input type="hidden" name="identifier" value={identifier} />
          <input type="hidden" name="vendorId" value={account.vendorId} />
          <input type="hidden" name="next" value={next ?? ''} />
          <button
            type="submit"
            className={`card accountChoiceCard${account.newItemCount > 0 ? ' accountChoiceCard-active' : ''}`}
            disabled={pending}
            style={{ width: '100%', textAlign: 'left' }}
          >
            <div className="row" style={{ justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
              <div className="stack" style={{ gap: 6 }}>
                <div className="kicker">Property manager</div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{account.propertyManagerName}</div>
                {account.propertyManagerCompany ? <div className="muted">{account.propertyManagerCompany}</div> : null}
                {account.propertyManagerEmail ? <div className="muted">{account.propertyManagerEmail}</div> : null}
                <div className="muted">Vendor account: {account.vendorName}</div>
              </div>
              <div className="stack" style={{ gap: 8, alignItems: 'flex-end' }}>
                {account.newItemCount > 0 ? <span className="badge flow-overdue">{account.newItemCount} new</span> : <span className="badge signalNeutral">No new items</span>}
                <div className="muted" style={{ textAlign: 'right' }}>
                  {account.openWorkCount} open work<br />
                  {account.pendingBidCount} bid invite{account.pendingBidCount === 1 ? '' : 's'}<br />
                  {account.paymentCount} payment{account.paymentCount === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          </button>
        </form>
      ))}
    </div>
  )
}
