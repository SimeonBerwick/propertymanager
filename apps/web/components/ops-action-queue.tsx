'use client'

import { useActionState } from 'react'
import { ManagerAccessCodeForm } from '@/components/manager-access-code-form'
import {
  resendTenantInviteFromOpsAction,
  sendDailyCsvExportNowAction,
  sendSystemEmailTestAction,
  updateVendorEmailFromOpsAction,
  type OpsCsvState,
} from '@/app/ops/actions'
import type { RecommendedAction } from '@/lib/recommended-actions'

const INITIAL_STATE: OpsCsvState = { error: null }

type VendorRequestMap = Record<string, Array<{ id: string; title: string; unitLabel?: string }>>

function idSuffix(action: RecommendedAction) {
  return action.id.slice(action.id.indexOf(':') + 1)
}

function contextualHref(href: string) {
  return href.startsWith('/requests/') ? href.split('#')[0] : href
}

function InlineState({ state }: { state: OpsCsvState }) {
  if (state.error) return <div className="notice error">{state.error}</div>
  if (state.success) return <div className="notice success">{state.success}</div>
  return null
}

function CsvSendNowForm() {
  const [state, formAction, pending] = useActionState(sendDailyCsvExportNowAction, INITIAL_STATE)
  return (
    <form action={formAction} className="stack" style={{ gap: 8 }}>
      <button className="button primary compactToggle" type="submit" disabled={pending}>
        {pending ? 'Sending CSV...' : 'Send CSV now'}
      </button>
      <InlineState state={state} />
    </form>
  )
}

function EmailTestForm() {
  const [state, formAction, pending] = useActionState(sendSystemEmailTestAction, INITIAL_STATE)
  return (
    <form action={formAction} className="stack" style={{ gap: 8 }}>
      <button className="button primary compactToggle" type="submit" disabled={pending}>
        {pending ? 'Sending test...' : 'Send delivery test'}
      </button>
      <InlineState state={state} />
    </form>
  )
}

function TenantInviteForm({ tenantIdentityId }: { tenantIdentityId: string }) {
  const [state, formAction, pending] = useActionState(resendTenantInviteFromOpsAction, INITIAL_STATE)
  return (
    <form action={formAction} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="tenantIdentityId" value={tenantIdentityId} />
      <button className="button primary compactToggle" type="submit" disabled={pending}>
        {pending ? 'Sending code...' : 'Send sign-in code'}
      </button>
      <InlineState state={state} />
    </form>
  )
}

function VendorEmailForm({ vendorId }: { vendorId: string }) {
  const [state, formAction, pending] = useActionState(updateVendorEmailFromOpsAction, INITIAL_STATE)
  return (
    <form action={formAction} className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
      <input type="hidden" name="vendorId" value={vendorId} />
      <input className="input" name="email" type="email" placeholder="vendor@example.com" required style={{ minWidth: 220 }} />
      <button className="button primary compactToggle" type="submit" disabled={pending}>
        {pending ? 'Saving...' : 'Save email'}
      </button>
      <InlineState state={state} />
    </form>
  )
}

function InlineActionControl({ action, vendorRequests }: { action: RecommendedAction, vendorRequests: VendorRequestMap }) {
  const subjectId = idSuffix(action)

  if (action.actionType === 'reconnect_mailbox' && action.href) {
    return <a className="button primary compactToggle" href={action.href}>{action.primaryLabel}</a>
  }

  if (action.actionType === 'review_csv_delivery_failure' || action.actionType === 'review_csv_export_schedule') {
    return <CsvSendNowForm />
  }

  if (action.actionType === 'review_email_delivery_failure') {
    return <EmailTestForm />
  }

  if (action.actionType === 'resend_tenant_invite') {
    return <TenantInviteForm tenantIdentityId={subjectId} />
  }

  if (action.actionType === 'help_tenant_access_portal' || action.actionType === 'confirm_tenant_access') {
    return (
      <details className="advancedDisclosure">
        <summary>{action.primaryLabel}</summary>
        <div style={{ marginTop: 12 }}>
          <ManagerAccessCodeForm role="tenant" recipientId={subjectId} recipientName={action.title} />
        </div>
      </details>
    )
  }

  if (action.actionType === 'add_vendor_email') {
    return <VendorEmailForm vendorId={subjectId} />
  }

  if (action.actionType === 'send_vendor_access_code' || action.actionType === 'help_vendor_access_portal') {
    return (
      <details className="advancedDisclosure">
        <summary>{action.primaryLabel}</summary>
        <div style={{ marginTop: 12 }}>
          <ManagerAccessCodeForm
            role="vendor"
            recipientId={subjectId}
            recipientName={action.title}
            requests={vendorRequests[subjectId] ?? []}
          />
        </div>
      </details>
    )
  }

  if (action.href && action.href !== '/ops') {
    return <a className="button compactToggle" href={contextualHref(action.href)}>{action.primaryLabel}</a>
  }

  return <span className="badge">{action.primaryLabel}</span>
}

export function OpsActionQueue({ actions, vendorRequests }: { actions: RecommendedAction[], vendorRequests: VendorRequestMap }) {
  return (
    <div className="nextActionGroupRows">
      {actions.map((action) => (
        <div key={action.id} className={`nextActionRow nextActionRow-${action.priority}`}>
          <div className="stack" style={{ gap: 8 }}>
            <div>
              <strong>{action.title}</strong>
              <div className="nextActionReason">{action.reason}</div>
            </div>
            <InlineActionControl action={action} vendorRequests={vendorRequests} />
          </div>
        </div>
      ))}
    </div>
  )
}
