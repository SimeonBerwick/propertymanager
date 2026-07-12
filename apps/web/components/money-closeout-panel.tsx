import { BillingDocumentForm } from '@/components/billing-document-form'
import { BillingDocumentList } from '@/components/billing-document-list'
import { BillingEventList } from '@/components/billing-event-list'
import { BillingSummaryCards } from '@/components/billing-summary-cards'
import { RequestBillbackForm } from '@/components/request-billback-form'
import { billingStatusLabel, formatMoney } from '@/lib/billing-utils'
import type { BillingDocumentView } from '@/lib/billing-types'
import type { CurrencyOption, MaintenanceRequest } from '@/lib/types'
import type { ReactNode } from 'react'

type MoneyState = 'done' | 'blocked' | 'needed' | 'waiting'

function StateBadge({ state }: { state: MoneyState }) {
  const label = state === 'done' ? 'Done' : state === 'blocked' ? 'Blocked' : state === 'needed' ? 'Needs action' : 'Waiting'
  return <span className={`badge moneyState-${state}`}>{label}</span>
}

function MoneyStep({
  title,
  state,
  children,
}: {
  title: string
  state: MoneyState
  children: ReactNode
}) {
  return (
    <div className={`moneyStep moneyStep-${state}`}>
      <div className="moneyStepHead">
        <strong>{title}</strong>
        <StateBadge state={state} />
      </div>
      <div className="muted">{children}</div>
    </div>
  )
}

function tenantBillbackSummary(request: Pick<MaintenanceRequest, 'tenantBillbackDecision' | 'tenantBillbackAmountCents' | 'tenantBillbackReason' | 'preferredCurrency'>) {
  if (request.tenantBillbackDecision === 'bill_tenant') {
    return `Charge tenant ${formatMoney(request.tenantBillbackAmountCents ?? 0, request.preferredCurrency)}${request.tenantBillbackReason ? ` - ${request.tenantBillbackReason}` : ''}`
  }
  if (request.tenantBillbackDecision === 'waived') return request.tenantBillbackReason ? `Waived - ${request.tenantBillbackReason}` : 'Waived'
  return 'No tenant chargeback'
}

function latestOpenDocument(documents: BillingDocumentView[]) {
  return documents.find((document) => document.status !== 'void' && document.totalCents > document.paidCents)
}

export function MoneyCloseoutPanel({
  request,
  billingDocuments,
  vendorBillPending,
  vendorAmountOwedCents,
  approvedBidCents,
  approvedOverageCents,
  pendingVendorExtrasCents,
  vendorOutstandingCents,
  postedVendorPaymentCents,
  postedVendorPaymentBalanceCents,
  billingOpenBalanceCents,
  needsTenantChargeDocument,
  needsVendorPaymentDocument,
  billingIsSettled,
  hasVendorChosen,
  approvedFinalInvoice,
  pendingFinalInvoice,
  approvedVendorExtrasCents,
  vendorAmountIfPendingApprovedCents,
}: {
  request: Pick<MaintenanceRequest,
    'id' | 'preferredCurrency' | 'submittedByEmail' | 'assignedVendorEmail' | 'tenantBillbackDecision' | 'tenantBillbackAmountCents' | 'tenantBillbackReason'
  >
  billingDocuments: BillingDocumentView[]
  vendorBillPending: boolean
  vendorAmountOwedCents: number
  approvedBidCents: number
  approvedOverageCents: number
  pendingVendorExtrasCents: number
  vendorOutstandingCents: number
  postedVendorPaymentCents: number
  postedVendorPaymentBalanceCents: number
  billingOpenBalanceCents: number
  needsTenantChargeDocument: boolean
  needsVendorPaymentDocument: boolean
  billingIsSettled: boolean
  hasVendorChosen: boolean
  approvedFinalInvoice?: { amountCents: number } | null
  pendingFinalInvoice?: { amountCents: number } | null
  approvedVendorExtrasCents: number
  vendorAmountIfPendingApprovedCents: number
}) {
  const currency = request.preferredCurrency as CurrencyOption
  const openDocument = latestOpenDocument(billingDocuments)
  const tenantChargebackCents = request.tenantBillbackDecision === 'bill_tenant' ? request.tenantBillbackAmountCents ?? 0 : 0
  const tenantChargeState: MoneyState = needsTenantChargeDocument ? 'needed' : 'done'
  const vendorAmountState: MoneyState = pendingVendorExtrasCents > 0
    ? 'blocked'
    : vendorBillPending
      ? 'waiting'
      : 'done'
  const paymentState: MoneyState = billingOpenBalanceCents > 0
    ? 'blocked'
    : needsVendorPaymentDocument || needsTenantChargeDocument
      ? 'needed'
      : 'done'
  const closeoutBlockers = [
    pendingVendorExtrasCents > 0 ? 'Vendor charge or invoice needs approval.' : null,
    needsTenantChargeDocument ? 'Tenant chargeback invoice has not been created or sent.' : null,
    needsVendorPaymentDocument ? 'Vendor payment record has not been created.' : null,
    billingOpenBalanceCents > 0 ? 'Open billing records must be marked paid.' : null,
  ].filter(Boolean)

  return (
    <section className="moneyCloseoutPanel stack" id="billing">
      <div className="sectionHead">
        <div>
          <div className="kicker">Money & closeout</div>
          <h2 style={{ margin: '4px 0' }}>Billing, payment records, and closing this request</h2>
          <div className="muted">Handle money outside the app. Use this panel to keep the work order record clear.</div>
        </div>
        <StateBadge state={billingIsSettled ? 'done' : closeoutBlockers.length ? 'blocked' : 'needed'} />
      </div>

      <div className="moneyCloseoutFocus">
        {pendingVendorExtrasCents > 0 ? (
          <div className="notice">
            <strong>Next money step: approve or decline vendor charge.</strong> Review the submitted amount before creating payment records or closing this request.
          </div>
        ) : billingOpenBalanceCents > 0 ? (
          <div className="notice">
            <strong>Next money step: mark payment record paid.</strong> Do this after the money is settled outside the app.
          </div>
        ) : needsVendorPaymentDocument ? (
          <div className="notice">
            <strong>Next money step: create vendor payment record.</strong> The vendor amount is approved, but the payment record has not been created yet.
          </div>
        ) : needsTenantChargeDocument ? (
          <div className="notice">
            <strong>Next money step: create tenant chargeback invoice.</strong> The tenant chargeback decision is set, but the invoice has not been created yet.
          </div>
        ) : vendorBillPending ? (
          <div className="notice">
            <strong>Next money step: confirm vendor charge.</strong> If there is a bill, record it below. If there is no charge, no vendor payment document is needed.
          </div>
        ) : billingIsSettled ? (
          <div className="notice success">
            <strong>Money is settled.</strong> No open tenant charges or vendor balances remain.
          </div>
        ) : null}
      </div>

      <details className="advancedDisclosure" open={!billingIsSettled}>
        <summary>{billingIsSettled ? 'Billing history and completed steps' : 'Current billing path'}</summary>
      <div className="moneyStepGrid" style={{ padding: 16 }}>
        <MoneyStep title="1. Vendor amount" state={vendorAmountState}>
          {pendingVendorExtrasCents > 0 ? (
            <>A vendor charge or invoice is waiting for approval before payment records or closeout.</>
          ) : vendorBillPending ? (
            <>Work is marked complete, but no vendor amount is recorded. If the vendor confirms no charge, you can leave vendor payment at $0 and continue closeout.</>
          ) : vendorOutstandingCents > 0 ? (
            <>Approved vendor amount is {formatMoney(vendorAmountOwedCents, currency)}. Still owed: {formatMoney(vendorOutstandingCents, currency)}.</>
          ) : (
            <>No vendor balance is currently open.</>
          )}
        </MoneyStep>

        <MoneyStep title="2. Tenant chargeback" state={tenantChargeState}>
          {tenantBillbackSummary(request)}
          {tenantChargebackCents > 0 && needsTenantChargeDocument ? ' Create and send the tenant charge before closeout.' : ''}
        </MoneyStep>

        <MoneyStep title="3. Payment record" state={paymentState}>
          {openDocument ? (
            <>{openDocument.title}: {billingStatusLabel(openDocument.status)} with {formatMoney(openDocument.totalCents - openDocument.paidCents, openDocument.currency)} still open.</>
          ) : needsVendorPaymentDocument ? (
            <>Create a vendor payment record for {formatMoney(vendorOutstandingCents, currency)}.</>
          ) : needsTenantChargeDocument ? (
            <>Create the tenant chargeback invoice for {formatMoney(tenantChargebackCents, currency)}.</>
          ) : (
            <>No open payment record is blocking closeout.</>
          )}
        </MoneyStep>

        <MoneyStep title="4. Closeout" state={billingIsSettled ? 'done' : closeoutBlockers.length ? 'blocked' : 'needed'}>
          {billingIsSettled ? 'All money decisions are complete. The request can be closed when the work status is ready.' : closeoutBlockers.join(' ')}
        </MoneyStep>
      </div>
      </details>

      {billingDocuments.length ? (
        <div className="stack" style={{ gap: 12 }}>
          <BillingSummaryCards documents={billingDocuments} />
          <BillingDocumentList documents={billingDocuments} requestId={request.id} />
        </div>
      ) : null}

      <details className="advancedDisclosure" open={needsTenantChargeDocument || needsVendorPaymentDocument || vendorBillPending}>
        <summary>Tenant chargeback decision</summary>
        <div className="stack" style={{ gap: 12, padding: 16 }}>
          <RequestBillbackForm
            requestId={request.id}
            decision={request.tenantBillbackDecision}
            amountCents={request.tenantBillbackAmountCents}
            reason={request.tenantBillbackReason}
          />
        </div>
      </details>

      {hasVendorChosen && (needsTenantChargeDocument || needsVendorPaymentDocument || vendorBillPending) ? (
        <details className="advancedDisclosure" open={needsTenantChargeDocument || needsVendorPaymentDocument}>
          <summary>Create tenant charge or vendor payment record</summary>
          <div className="stack" style={{ gap: 12, padding: 16 }}>
            <BillingDocumentForm
              requestId={request.id}
              tenantEmail={request.submittedByEmail}
              vendorEmail={request.assignedVendorEmail}
              tenantBillbackDecision={request.tenantBillbackDecision}
              tenantBillbackAmountCents={request.tenantBillbackAmountCents}
              tenantBillbackReason={request.tenantBillbackReason}
            />
          </div>
        </details>
      ) : !hasVendorChosen ? (
        <div className="notice">Choose a vendor before creating invoices or payments for this request.</div>
      ) : null}

      {(pendingVendorExtrasCents > 0 || approvedVendorExtrasCents > 0 || postedVendorPaymentBalanceCents > 0 || approvedBidCents > 0) ? (
        <details className="advancedDisclosure">
          <summary>Show vendor math</summary>
          <div className="detailFactsGrid" style={{ padding: 16 }}>
            <div><strong>Approved bid</strong><div className="muted">{formatMoney(approvedBidCents, currency)}</div></div>
            <div><strong>{approvedFinalInvoice ? 'Final invoice' : 'Approved extras'}</strong><div className="muted">{formatMoney(approvedFinalInvoice?.amountCents ?? approvedVendorExtrasCents, currency)}</div></div>
            <div><strong>{pendingFinalInvoice ? 'Pending final invoice' : 'Pending extras'}</strong><div className="muted">{formatMoney(pendingFinalInvoice?.amountCents ?? pendingVendorExtrasCents, currency)}</div></div>
            <div><strong>If pending approved</strong><div className="muted">{formatMoney(vendorAmountIfPendingApprovedCents, currency)}</div></div>
            <div><strong>Paid</strong><div className="muted">{formatMoney(postedVendorPaymentCents, currency)}</div></div>
            <div><strong>Still open</strong><div className="muted">{formatMoney(postedVendorPaymentBalanceCents, currency)}</div></div>
            <div><strong>Over approved bid</strong><div className="muted">{formatMoney(approvedOverageCents, currency)}</div></div>
          </div>
        </details>
      ) : null}

      <BillingEventList documents={billingDocuments} />
    </section>
  )
}
