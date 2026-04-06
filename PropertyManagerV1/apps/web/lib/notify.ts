/**
 * Provider-agnostic notification layer.
 *
 * Transports (controlled by NOTIFY_TRANSPORT env var):
 *   unset / "log" — writes to stdout; safe dev default, zero config required.
 *   "smtp"        — sends email via nodemailer using SMTP_URL.
 *                   Requires: SMTP_URL, optionally NOTIFY_FROM.
 *
 * Notifications are best-effort: transport errors are logged but never
 * propagate back to the caller so a failed email never breaks a user action.
 */

import { currencyLabel, languageLabel, type DispatchStatus, type RequestStatus } from '@/lib/types'

export interface NotificationMessage {
  to: string
  subject: string
  text: string
  /** Optional HTML body. When present, email clients that support HTML will
   *  render it; clients that don't fall back to `text`. */
  html?: string
}

// ── Transports ────────────────────────────────────────────────────────────────

function sendViaLog(msg: NotificationMessage): void {
  console.log(
    `\n[NOTIFY] ──────────────────────────────────────\n` +
    `  To:      ${msg.to}\n` +
    `  Subject: ${msg.subject}\n` +
    `  ─────────────────────────────────────────────\n` +
    `  ${msg.text.replace(/\n/g, '\n  ')}\n` +
    `[/NOTIFY] ─────────────────────────────────────\n`,
  )
}

async function sendViaSmtp(msg: NotificationMessage): Promise<void> {
  const smtpUrl = process.env.SMTP_URL
  if (!smtpUrl) throw new Error('NOTIFY_TRANSPORT=smtp requires SMTP_URL to be set.')

  const nodemailer = await import('nodemailer')
  const transport = nodemailer.createTransport(smtpUrl)
  await transport.sendMail({
    from: process.env.NOTIFY_FROM ?? 'Property Manager <noreply@propertymanager.local>',
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    ...(msg.html ? { html: msg.html } : {}),
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Dispatch a notification. Never throws — transport failures are caught and
 * logged so callers don't need try/catch around notification calls.
 * Returns { ok: false } when the transport fails so callers can surface a warning.
 */
export async function sendNotification(msg: NotificationMessage): Promise<{ ok: boolean }> {
  try {
    if (process.env.NOTIFY_TRANSPORT === 'smtp') {
      await sendViaSmtp(msg)
    } else {
      sendViaLog(msg)
    }
    return { ok: true }
  } catch (err) {
    console.error('[NOTIFY] Transport error — notification was not delivered:', err)
    return { ok: false }
  }
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

/** Escape user-supplied strings for safe HTML embedding. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Wrap content in a minimal responsive email shell.
 * Uses only inline styles — no external CSS, no JavaScript.
 */
function htmlEmail(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:6px;overflow:hidden;max-width:600px;width:100%">
        <tr><td style="background:#1a56db;padding:16px 24px">
          <span style="color:#ffffff;font-size:18px;font-weight:bold">Property Manager</span>
        </td></tr>
        <tr><td style="padding:24px;color:#111827;font-size:15px;line-height:1.6">
          ${body}
        </td></tr>
        <tr><td style="background:#f9fafb;padding:12px 24px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb">
          This is an automated message — please do not reply directly to this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/** Render a two-column details table row. */
function dtRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${esc(label)}</td>
    <td style="padding:4px 0;color:#111827">${esc(value)}</td>
  </tr>`
}

// ── Message builders ──────────────────────────────────────────────────────────

export interface NewRequestParams {
  requestId: string
  title: string
  propertyName: string
  unitLabel: string
  tenantName: string
  tenantEmail: string
  landlordEmail: string
  urgency: string
  category: string
  description: string
  preferredCurrency: string
  preferredLanguage: string
}

/**
 * Returns [tenantConfirmation, landlordAlert] messages for a new submission.
 */
export function buildNewRequestMessages(p: NewRequestParams): [NotificationMessage, NotificationMessage] {
  const tenantMsg: NotificationMessage = {
    to: p.tenantEmail,
    subject: `Maintenance request received — ${p.title}`,
    text: [
      `Hi ${p.tenantName},`,
      ``,
      `We received your maintenance request and it's in our queue.`,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Unit         : ${p.unitLabel} — ${p.propertyName}`,
      `  Category     : ${p.category}`,
      `  Urgency      : ${p.urgency}`,
      `  Currency     : ${currencyLabel(p.preferredCurrency as 'usd' | 'peso' | 'pound' | 'euro')}`,
      `  Language     : ${languageLabel(p.preferredLanguage as 'english' | 'spanish' | 'french')}`,
      ``,
      `We'll be in touch once a vendor is scheduled. Reply to this email if you have questions.`,
    ].join('\n'),
    html: htmlEmail(`
      <p>Hi ${esc(p.tenantName)},</p>
      <p>We received your maintenance request and it&rsquo;s in our queue.</p>
      <table cellpadding="0" cellspacing="0" style="margin:16px 0">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Unit', `${p.unitLabel} — ${p.propertyName}`)}
        ${dtRow('Category', p.category)}
        ${dtRow('Urgency', p.urgency)}
        ${dtRow('Currency', currencyLabel(p.preferredCurrency as 'usd' | 'peso' | 'pound' | 'euro'))}
        ${dtRow('Language', languageLabel(p.preferredLanguage as 'english' | 'spanish' | 'french'))}
      </table>
      <p>We&rsquo;ll be in touch once a vendor is scheduled. Reply to this email if you have questions.</p>
    `),
  }

  const landlordMsg: NotificationMessage = {
    to: p.landlordEmail,
    subject: `[New request] ${p.title} — ${p.propertyName} / ${p.unitLabel}`,
    text: [
      `A new maintenance request was submitted.`,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Property     : ${p.propertyName}`,
      `  Unit         : ${p.unitLabel}`,
      `  Category     : ${p.category}`,
      `  Urgency      : ${p.urgency}`,
      `  Currency     : ${currencyLabel(p.preferredCurrency as 'usd' | 'peso' | 'pound' | 'euro')}`,
      `  Language     : ${languageLabel(p.preferredLanguage as 'english' | 'spanish' | 'french')}`,
      `  Tenant       : ${p.tenantName} <${p.tenantEmail}>`,
      ``,
      `Description:`,
      p.description,
    ].join('\n'),
    html: htmlEmail(`
      <p>A new maintenance request was submitted.</p>
      <table cellpadding="0" cellspacing="0" style="margin:16px 0">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Property', p.propertyName)}
        ${dtRow('Unit', p.unitLabel)}
        ${dtRow('Category', p.category)}
        ${dtRow('Urgency', p.urgency)}
        ${dtRow('Currency', currencyLabel(p.preferredCurrency as 'usd' | 'peso' | 'pound' | 'euro'))}
        ${dtRow('Language', languageLabel(p.preferredLanguage as 'english' | 'spanish' | 'french'))}
        ${dtRow('Tenant', `${p.tenantName} <${p.tenantEmail}>`)}
      </table>
      <p style="font-weight:bold">Description</p>
      <p style="white-space:pre-wrap;background:#f9fafb;border-left:4px solid #1a56db;padding:12px 16px;border-radius:0 4px 4px 0">${esc(p.description)}</p>
    `),
  }

  return [tenantMsg, landlordMsg]
}

export interface StatusChangedParams {
  requestId: string
  title: string
  propertyName: string
  unitLabel: string
  tenantEmail: string
  tenantName: string
  fromStatus: RequestStatus
  toStatus: RequestStatus
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'New — awaiting triage',
  scheduled: 'Scheduled — a vendor has been booked',
  in_progress: 'In Progress — work is underway',
  done: 'Done — work is complete',
}

/**
 * Returns a tenant notification for a status transition.
 * Only call when tenantEmail is known.
 */
export function buildStatusChangedMessage(p: StatusChangedParams): NotificationMessage {
  const closingText = p.toStatus === 'done'
    ? 'The work is complete. Please reply if you have any concerns.'
    : "We'll keep you updated as the work progresses."

  return {
    to: p.tenantEmail,
    subject: `Update on your maintenance request — ${p.title}`,
    text: [
      `Hi ${p.tenantName},`,
      ``,
      `Your maintenance request has been updated.`,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Unit         : ${p.unitLabel} — ${p.propertyName}`,
      `  New status   : ${STATUS_LABELS[p.toStatus]}`,
      ``,
      closingText,
    ].join('\n'),
    html: htmlEmail(`
      <p>Hi ${esc(p.tenantName)},</p>
      <p>Your maintenance request has been updated.</p>
      <table cellpadding="0" cellspacing="0" style="margin:16px 0">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Unit', `${p.unitLabel} — ${p.propertyName}`)}
        ${dtRow('New status', STATUS_LABELS[p.toStatus])}
      </table>
      <p>${esc(closingText)}</p>
    `),
  }
}

export interface VendorAssignedParams {
  requestId: string
  title: string
  propertyName: string
  unitLabel: string
  vendorName: string
  vendorEmail: string
  tenantName?: string
  tenantEmail?: string
  urgency: string
  category: string
  preferredCurrency?: string
  preferredLanguage?: string
  responseLink?: string
}

export function buildVendorAssignedMessage(p: VendorAssignedParams): NotificationMessage {
  return {
    to: p.vendorEmail,
    subject: `New maintenance assignment — ${p.title}`,
    text: [
      `Hi ${p.vendorName},`,
      ``,
      `You have been assigned a maintenance request.`,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Property     : ${p.propertyName}`,
      `  Unit         : ${p.unitLabel}`,
      `  Category     : ${p.category}`,
      `  Urgency      : ${p.urgency}`,
      p.preferredCurrency ? `  Currency     : ${currencyLabel(p.preferredCurrency as 'usd' | 'peso' | 'pound' | 'euro')}` : '',
      p.preferredLanguage ? `  Language     : ${languageLabel(p.preferredLanguage as 'english' | 'spanish' | 'french')}` : '',
      p.tenantName || p.tenantEmail ? `  Tenant       : ${[p.tenantName, p.tenantEmail].filter(Boolean).join(' · ')}` : '',
      ``,
      p.responseLink ? `Respond here: ${p.responseLink}` : 'Please contact the operator to confirm scheduling and next steps.',
    ].filter(Boolean).join('\n'),
    html: htmlEmail(`
      <p>Hi ${esc(p.vendorName)},</p>
      <p>You have been assigned a maintenance request.</p>
      <table cellpadding="0" cellspacing="0" style="margin:16px 0">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Property', p.propertyName)}
        ${dtRow('Unit', p.unitLabel)}
        ${dtRow('Category', p.category)}
        ${dtRow('Urgency', p.urgency)}
        ${p.preferredCurrency ? dtRow('Currency', currencyLabel(p.preferredCurrency as 'usd' | 'peso' | 'pound' | 'euro')) : ''}
        ${p.preferredLanguage ? dtRow('Language', languageLabel(p.preferredLanguage as 'english' | 'spanish' | 'french')) : ''}
        ${p.tenantName || p.tenantEmail ? dtRow('Tenant', [p.tenantName, p.tenantEmail].filter(Boolean).join(' · ')) : ''}
      </table>
      <p>${p.responseLink ? `Respond here: <a href="${esc(p.responseLink)}">${esc(p.responseLink)}</a>` : 'Please contact the operator to confirm scheduling and next steps.'}</p>
    `),
  }
}

export interface TenantVendorUpdateParams {
  requestId: string
  title: string
  propertyName: string
  unitLabel: string
  tenantEmail: string
  tenantName: string
  vendorName: string
  dispatchStatus: DispatchStatus
  note?: string
  scheduledStart?: string
  scheduledEnd?: string
  photoCount?: number
}

export interface BillingDocumentNotificationParams {
  to: string
  title: string
  recipientLabel: string
  documentType: string
  status: string
  amountLabel: string
  paidLabel: string
  balanceLabel: string
}

export function buildTenantVendorUpdateMessage(p: TenantVendorUpdateParams): NotificationMessage {
  const scheduleLine = p.scheduledStart
    ? `${new Date(p.scheduledStart).toLocaleString()}${p.scheduledEnd ? ` → ${new Date(p.scheduledEnd).toLocaleString()}` : ''}`
    : ''

  return {
    to: p.tenantEmail,
    subject: `Vendor update for your maintenance request — ${p.title}`,
    text: [
      `Hi ${p.tenantName},`,
      ``,
      `Your maintenance request has a vendor update.`,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Unit         : ${p.unitLabel} — ${p.propertyName}`,
      `  Vendor       : ${p.vendorName}`,
      `  Dispatch     : ${p.dispatchStatus}`,
      scheduleLine ? `  Schedule     : ${scheduleLine}` : '',
      p.photoCount ? `  Photos       : ${p.photoCount} new photo${p.photoCount === 1 ? '' : 's'}` : '',
      p.note ? `Note: ${p.note}` : '',
    ].filter(Boolean).join('\n'),
    html: htmlEmail(`
      <p>Hi ${esc(p.tenantName)},</p>
      <p>Your maintenance request has a vendor update.</p>
      <table cellpadding="0" cellspacing="0" style="margin:16px 0">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Unit', `${p.unitLabel} — ${p.propertyName}`)}
        ${dtRow('Vendor', p.vendorName)}
        ${dtRow('Dispatch', p.dispatchStatus)}
        ${scheduleLine ? dtRow('Schedule', scheduleLine) : ''}
        ${p.photoCount ? dtRow('Photos', `${p.photoCount} new photo${p.photoCount === 1 ? '' : 's'}`) : ''}
      </table>
      ${p.note ? `<p><strong>Note:</strong> ${esc(p.note)}</p>` : ''}
    `),
  }
}

export interface LandlordExceptionSummaryParams {
  landlordEmail: string
  requests: Array<{
    id: string
    title: string
    propertyName: string
    unitLabel: string
    autoFlag?: string
    reviewState?: string
  }>
}

export function buildLandlordExceptionSummaryMessage(p: LandlordExceptionSummaryParams): NotificationMessage {
  return {
    to: p.landlordEmail,
    subject: `[Mission Control] Daily exception summary`,
    text: [
      `Daily exception summary`,
      ``,
      ...p.requests.map((request) =>
        `- ${request.title} (${request.propertyName} / ${request.unitLabel}) · flag=${request.autoFlag ?? 'none'} · review=${request.reviewState ?? 'none'}`,
      ),
    ].join('\n'),
    html: htmlEmail(`
      <p><strong>Daily exception summary</strong></p>
      <table cellpadding="0" cellspacing="0" style="margin:16px 0">
        ${p.requests.map((request) => `
          <tr>
            <td style="padding:8px 12px 8px 0;vertical-align:top;color:#111827">${esc(request.title)}</td>
            <td style="padding:8px 12px 8px 0;vertical-align:top;color:#6b7280">${esc(`${request.propertyName} / ${request.unitLabel}`)}</td>
            <td style="padding:8px 12px 8px 0;vertical-align:top;color:#6b7280">${esc(request.autoFlag ?? 'none')}</td>
            <td style="padding:8px 0;vertical-align:top;color:#6b7280">${esc(request.reviewState ?? 'none')}</td>
          </tr>
        `).join('')}
      </table>
    `),
  }
}

export function buildBillingDocumentMessage(p: BillingDocumentNotificationParams): NotificationMessage {
  return {
    to: p.to,
    subject: p.title,
    text: [
      `${p.title}`,
      ``,
      `Recipient: ${p.recipientLabel}`,
      `Type: ${p.documentType}`,
      `Status: ${p.status}`,
      `Amount: ${p.amountLabel}`,
      `Paid: ${p.paidLabel}`,
      `Balance: ${p.balanceLabel}`,
    ].join('\n'),
    html: htmlEmail(`
      <p>${esc(p.title)}</p>
      <table cellpadding="0" cellspacing="0" style="margin:16px 0">
        ${dtRow('Recipient', p.recipientLabel)}
        ${dtRow('Type', p.documentType)}
        ${dtRow('Status', p.status)}
        ${dtRow('Amount', p.amountLabel)}
        ${dtRow('Paid', p.paidLabel)}
        ${dtRow('Balance', p.balanceLabel)}
      </table>
    `),
  }
}
