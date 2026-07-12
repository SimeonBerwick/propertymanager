/**
 * Provider-agnostic notification layer.
 *
 * Transports (controlled by NOTIFY_TRANSPORT env var):
 *   unset / "log" - writes to stdout; safe dev default, zero config required.
 *   "smtp"        - sends email via nodemailer using SMTP_URL.
 *                   Requires: SMTP_URL, optionally NOTIFY_FROM.
 *
 * Notifications are best-effort: transport errors are logged but never
 * propagate back to the caller so a failed email never breaks a user action.
 */

import { getRuntimeFailures, isHostedRuntimeEnforced } from '@/lib/runtime-env'
import { logFallbackEmail, sendViaConnectedMailbox, type NotificationContext } from '@/lib/mailbox-service'
import { prisma } from '@/lib/prisma'
import { sendPushNotification } from '@/lib/push'
import { deriveRequestCloseoutLanguage } from '@/lib/request-closeout-language'
import { currencyLabel, languageLabel, type DispatchStatus, type RequestStatus } from '@/lib/types'
import { formatAppointmentDateTime, formatAppointmentWindow } from '@/lib/appointment-time'

export interface NotificationMessage {
  to: string
  subject: string
  text: string
  requestId?: string
  actionUrl?: string
  /** Optional HTML body. When present, email clients that support HTML will
   *  render it; clients that don't fall back to `text`. */
  html?: string
  attachments?: Array<{
    filename: string
    content: string
    contentType?: string
  }>
}

// Transports

function sendViaLog(msg: NotificationMessage): void {
  console.log(
    `\n[NOTIFY] --------------------------------------\n` +
    `  To:      ${msg.to}\n` +
    `  Subject: ${msg.subject}\n` +
    `  ---------------------------------------------\n` +
    `  ${msg.text.replace(/\n/g, '\n  ')}\n` +
    `[/NOTIFY] -------------------------------------\n`,
  )
}

async function sendViaSmtp(msg: NotificationMessage): Promise<void> {
  const smtpUrl = process.env.SMTP_URL
  if (!smtpUrl) throw new Error('NOTIFY_TRANSPORT=smtp requires SMTP_URL to be set.')

  const nodemailer = await import('nodemailer')
  const transport = nodemailer.createTransport(smtpUrl)
  await transport.sendMail({
    from: process.env.NOTIFY_FROM ?? 'Simeonware Maintenance Manager <noreply@propertymanager.local>',
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    ...(msg.html ? { html: msg.html } : {}),
    ...(msg.attachments?.length ? {
      attachments: msg.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType ?? 'text/csv; charset=utf-8',
      })),
    } : {}),
  })
}

// Public API

/**
 * Dispatch a notification. Never throws - transport failures are caught and
 * logged so callers don't need try/catch around notification calls.
 * Returns { ok: false } when the transport fails so callers can surface a warning.
 */
function withRequestSubject(msg: NotificationMessage, context: NotificationContext) {
  const requestId = context.requestId ?? msg.requestId
  if (!requestId || msg.subject.includes(`[PMR:${requestId}]`)) return msg
  return { ...msg, subject: `${msg.subject} [PMR:${requestId}]`, requestId }
}

export async function sendNotification(msg: NotificationMessage, context: NotificationContext = {}): Promise<{ ok: boolean }> {
  const normalized = withRequestSubject(msg, context)
  try {
    if (context.ownerUserId && !context.bypassUserPreference) {
      const preference = await prisma.user.findUnique({
        where: { id: context.ownerUserId },
        select: { emailNotificationsEnabled: true },
      })
      if (preference?.emailNotificationsEnabled === false) return { ok: false }
    }

    await sendPushNotification(normalized).catch((error) => {
      console.error('[NOTIFY] Push delivery failed; continuing with email delivery:', error)
    })

    if (context.transportHint === 'connected-mailbox') {
      const mailbox = await sendViaConnectedMailbox(normalized, context)
      if (mailbox.attempted && mailbox.ok) return { ok: true }
    }

    if (process.env.NOTIFY_TRANSPORT === 'smtp') {
      await sendViaSmtp(normalized)
      await logFallbackEmail(normalized, context, 'smtp', true)
      return { ok: true }
    }

    if (isHostedRuntimeEnforced()) {
      const failures = getRuntimeFailures(['notifications'])
      console.error(
        '[NOTIFY] Hosted runtime is not allowed to fall back to log delivery:',
        failures.map((failure) => `${failure.label} - ${failure.detail}`).join(' | '),
      )
      return { ok: false }
    }

    sendViaLog(normalized)
    await logFallbackEmail(normalized, context, 'log', true)
    return { ok: true }
  } catch (err) {
    await logFallbackEmail(normalized, context, process.env.NOTIFY_TRANSPORT === 'smtp' ? 'smtp' : 'log', false, err)
    console.error('[NOTIFY] Transport error - notification was not delivered:', err)
    return { ok: false }
  }
}

// HTML helpers

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
 * Uses a hybrid-fluid table layout so Gmail Android can shrink the message
 * while Outlook keeps a predictable desktop width.
 */
function htmlEmail(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;width:100%">
  <center style="width:100%;background-color:#f4f4f4">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#f4f4f4;mso-table-lspace:0pt;mso-table-rspace:0pt">
      <tr>
        <td align="center" style="padding:16px 8px">
          <!--[if mso]>
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td>
          <![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;mso-table-lspace:0pt;mso-table-rspace:0pt">
            <tr>
              <td bgcolor="#1a56db" style="background-color:#1a56db;padding:16px 20px">
                <span style="color:#ffffff;font-size:18px;line-height:22px;font-weight:bold;font-family:Arial,Helvetica,sans-serif">Simeonware Maintenance Manager</span>
              </td>
            </tr>
            <tr>
              <td style="padding:20px;color:#111827;font-size:15px;line-height:23px;font-family:Arial,Helvetica,sans-serif;word-break:normal;overflow-wrap:break-word">
          ${body}
              </td>
            </tr>
            <tr>
              <td bgcolor="#f9fafb" style="background-color:#f9fafb;padding:12px 20px;font-size:12px;line-height:18px;color:#6b7280;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif">
                This is an automated message - please do not reply directly to this email.
              </td>
            </tr>
          </table>
          <!--[if mso]>
          </td></tr></table>
          <![endif]-->
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`
}

/** Render a two-column details table row. */
function dtRow(label: string, value: string): string {
  return `<tr>
    <td width="120" style="width:120px;padding:5px 12px 5px 0;color:#6b7280;vertical-align:top;font-size:14px;line-height:20px;font-family:Arial,Helvetica,sans-serif">${esc(label)}</td>
    <td style="padding:5px 0;color:#111827;vertical-align:top;font-size:14px;line-height:20px;font-family:Arial,Helvetica,sans-serif;word-break:normal;overflow-wrap:break-word">${esc(value)}</td>
  </tr>`
}

function actionButton(label: string, href?: string): string {
  if (!href) return ''
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        <tr>
          <td bgcolor="#1a56db" style="background-color:#1a56db">
            <a href="${esc(href)}" style="display:inline-block;padding:10px 16px;color:#ffffff;text-decoration:none;font-weight:bold;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px">${esc(label)}</a>
          </td>
        </tr>
      </table>
      <p style="margin:10px 0 0 0;color:#6b7280;font-size:12px;line-height:18px;word-break:break-all;overflow-wrap:break-word">${esc(href)}</p>`
}

function escLines(s: string): string {
  return esc(s).replace(/\r\n|\r|\n/g, '<br>')
}

// Message builders

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
  tenantActionUrl?: string
  landlordActionUrl?: string
}

/**
 * Returns [tenantConfirmation, landlordAlert] messages for a new submission.
 */
export function buildNewRequestMessages(p: NewRequestParams): [NotificationMessage, NotificationMessage] {
  const tenantMsg: NotificationMessage = {
    to: p.tenantEmail,
    subject: `Maintenance request received - ${p.title}`,
    text: [
      `Hi ${p.tenantName},`,
      ``,
      `We received your maintenance request and it's in our queue.`,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Unit         : ${p.unitLabel} - ${p.propertyName}`,
      `  Category     : ${p.category}`,
      `  Urgency      : ${p.urgency}`,
      `  Language     : ${languageLabel(p.preferredLanguage as 'english' | 'spanish' | 'french')}`,
      ``,
      p.tenantActionUrl ? `Open request: ${p.tenantActionUrl}` : '',
      p.tenantActionUrl ? `` : '',
      `We'll be in touch once a vendor is scheduled. Reply to this email if you have questions.`,
    ].filter((line, index, lines) => line !== '' || lines[index - 1] !== '').join('\n'),
    html: htmlEmail(`
      <p style="margin:0 0 14px 0">Hi ${esc(p.tenantName)},</p>
      <p style="margin:0 0 14px 0">We received your maintenance request and it&rsquo;s in our queue.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:14px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Unit', `${p.unitLabel} - ${p.propertyName}`)}
        ${dtRow('Category', p.category)}
        ${dtRow('Urgency', p.urgency)}
        ${dtRow('Language', languageLabel(p.preferredLanguage as 'english' | 'spanish' | 'french'))}
      </table>
      ${actionButton('Open request', p.tenantActionUrl)}
      <p style="margin:14px 0 0 0">We&rsquo;ll be in touch once a vendor is scheduled. Reply to this email if you have questions.</p>
    `),
    requestId: p.requestId,
    actionUrl: p.tenantActionUrl,
  }

  const landlordMsg: NotificationMessage = {
    to: p.landlordEmail,
    subject: `[New request] ${p.title} - ${p.propertyName} / ${p.unitLabel}`,
    text: [
      `A new maintenance request was submitted.`,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Property     : ${p.propertyName}`,
      `  Unit         : ${p.unitLabel}`,
      `  Category     : ${p.category}`,
      `  Urgency      : ${p.urgency}`,
      `  Language     : ${languageLabel(p.preferredLanguage as 'english' | 'spanish' | 'french')}`,
      `  Tenant       : ${p.tenantName} <${p.tenantEmail}>`,
      ``,
      `Description:`,
      p.description,
      ``,
      p.landlordActionUrl ? `Open request: ${p.landlordActionUrl}` : '',
    ].filter((line, index, lines) => line !== '' || lines[index - 1] !== '').join('\n'),
    html: htmlEmail(`
      <p style="margin:0 0 14px 0">A new maintenance request was submitted.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:14px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Property', p.propertyName)}
        ${dtRow('Unit', p.unitLabel)}
        ${dtRow('Category', p.category)}
        ${dtRow('Urgency', p.urgency)}
        ${dtRow('Language', languageLabel(p.preferredLanguage as 'english' | 'spanish' | 'french'))}
        ${dtRow('Tenant', `${p.tenantName} <${p.tenantEmail}>`)}
      </table>
      <p style="margin:14px 0 8px 0;font-weight:bold">Description</p>
      <p style="margin:0;background-color:#f9fafb;border-left:4px solid #1a56db;padding:12px 16px">${escLines(p.description)}</p>
      ${actionButton('Open request', p.landlordActionUrl)}
    `),
    requestId: p.requestId,
    actionUrl: p.landlordActionUrl,
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
  actionUrl?: string
}

/**
 * Returns a tenant notification for a status transition.
 * Only call when tenantEmail is known.
 */
export function buildStatusChangedMessage(p: StatusChangedParams): NotificationMessage {
  const statusLabel = deriveRequestCloseoutLanguage({ status: p.toStatus }).tenantLabel
  const closingText = p.toStatus === 'closed'
    ? 'The work is complete. Please reply if you have any concerns.'
    : "We'll keep you updated as the work progresses."

  return {
    to: p.tenantEmail,
    subject: `Update on your maintenance request - ${p.title}`,
    text: [
      `Hi ${p.tenantName},`,
      ``,
      `Your maintenance request has been updated.`,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Unit         : ${p.unitLabel} - ${p.propertyName}`,
      `  New status   : ${statusLabel}`,
      ``,
      p.actionUrl ? `Open request: ${p.actionUrl}` : '',
      p.actionUrl ? `` : '',
      closingText,
    ].filter((line, index, lines) => line !== '' || lines[index - 1] !== '').join('\n'),
    html: htmlEmail(`
      <p style="margin:0 0 14px 0">Hi ${esc(p.tenantName)},</p>
      <p style="margin:0 0 14px 0">Your maintenance request has been updated.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:14px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Unit', `${p.unitLabel} - ${p.propertyName}`)}
        ${dtRow('New status', statusLabel)}
      </table>
      ${actionButton('Open request', p.actionUrl)}
      <p style="margin:14px 0 0 0">${esc(closingText)}</p>
    `),
    requestId: p.requestId,
    actionUrl: p.actionUrl,
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
  actionUrl?: string
}

export interface VendorDailyReminderParams {
  requestId: string
  title: string
  propertyName: string
  unitLabel: string
  vendorName: string
  vendorEmail: string
  actionLabel: string
  actionDetail: string
  actionUrl: string
}

export function buildVendorDailyReminderMessage(p: VendorDailyReminderParams): NotificationMessage {
  return {
    to: p.vendorEmail,
    subject: `Reminder: ${p.actionLabel} - ${p.title}`,
    text: [
      `Hi ${p.vendorName},`,
      ``,
      `This work order is waiting for you: ${p.actionLabel}.`,
      p.actionDetail,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Property     : ${p.propertyName}`,
      `  Unit         : ${p.unitLabel}`,
      ``,
      `Take action: ${p.actionUrl}`,
    ].join('\n'),
    html: htmlEmail(`
      <p style="margin:0 0 14px 0">Hi ${esc(p.vendorName)},</p>
      <p style="margin:0 0 8px 0">This work order is waiting for you: <strong>${esc(p.actionLabel)}</strong>.</p>
      <p style="margin:0 0 14px 0">${esc(p.actionDetail)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:14px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Property', p.propertyName)}
        ${dtRow('Unit', p.unitLabel)}
      </table>
      ${actionButton('Open work order', p.actionUrl)}
    `),
    requestId: p.requestId,
    actionUrl: p.actionUrl,
  }
}

export function buildVendorAssignedMessage(p: VendorAssignedParams): NotificationMessage {
  const actionUrl = p.actionUrl ?? p.responseLink
  return {
    to: p.vendorEmail,
    subject: `New maintenance assignment - ${p.title}`,
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
      p.preferredLanguage ? `  Language     : ${languageLabel(p.preferredLanguage as 'english' | 'spanish' | 'french')}` : '',
      p.tenantName || p.tenantEmail ? `  Tenant       : ${[p.tenantName, p.tenantEmail].filter(Boolean).join(' - ')}` : '',
      ``,
      actionUrl ? `Respond here: ${actionUrl}` : 'Please contact the operator to confirm scheduling and next steps.',
    ].filter(Boolean).join('\n'),
    html: htmlEmail(`
      <p style="margin:0 0 14px 0">Hi ${esc(p.vendorName)},</p>
      <p style="margin:0 0 14px 0">You have been assigned a maintenance request.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:14px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Property', p.propertyName)}
        ${dtRow('Unit', p.unitLabel)}
        ${dtRow('Category', p.category)}
        ${dtRow('Urgency', p.urgency)}
        ${p.preferredLanguage ? dtRow('Language', languageLabel(p.preferredLanguage as 'english' | 'spanish' | 'french')) : ''}
        ${p.tenantName || p.tenantEmail ? dtRow('Tenant', [p.tenantName, p.tenantEmail].filter(Boolean).join(' - ')) : ''}
      </table>
      ${actionButton('Respond to assignment', actionUrl)}
      ${actionUrl ? '' : '<p style="margin:14px 0 0 0">Please contact the operator to confirm scheduling and next steps.</p>'}
    `),
    requestId: p.requestId,
    actionUrl,
  }
}

export interface VendorAwardedParams extends VendorAssignedParams {
  bidAmountLabel?: string
}

export function buildVendorAwardedMessage(p: VendorAwardedParams): NotificationMessage {
  const actionUrl = p.actionUrl ?? p.responseLink
  return {
    to: p.vendorEmail,
    subject: `Bid awarded - ${p.title}`,
    text: [
      `Hi ${p.vendorName},`,
      ``,
      `Your bid was awarded. Please open the work order and send the next update.`,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Property     : ${p.propertyName}`,
      `  Unit         : ${p.unitLabel}`,
      p.bidAmountLabel ? `  Bid          : ${p.bidAmountLabel}` : '',
      ``,
      actionUrl ? `Open work order: ${actionUrl}` : 'Please sign in to the vendor portal to update this work order.',
    ].filter(Boolean).join('\n'),
    html: htmlEmail(`
      <p style="margin:0 0 14px 0">Hi ${esc(p.vendorName)},</p>
      <p style="margin:0 0 14px 0">Your bid was awarded. Please open the work order and send the next update.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:14px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Property', p.propertyName)}
        ${dtRow('Unit', p.unitLabel)}
        ${p.bidAmountLabel ? dtRow('Bid', p.bidAmountLabel) : ''}
      </table>
      ${actionButton('Open work order', actionUrl)}
      ${actionUrl ? '' : '<p style="margin:14px 0 0 0">Please sign in to the vendor portal to update this work order.</p>'}
    `),
    requestId: p.requestId,
    actionUrl,
  }
}

export interface VendorCanceledParams {
  requestId: string
  title: string
  propertyName: string
  unitLabel: string
  vendorName: string
  vendorEmail: string
  reason: string
  revisedBidUrl?: string
}

export function buildVendorCanceledMessage(p: VendorCanceledParams): NotificationMessage {
  return {
    to: p.vendorEmail,
    subject: `Work order canceled - ${p.title}`,
    text: [
      `Hi ${p.vendorName},`,
      ``,
      `The property manager canceled your selection for this work order.`,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Property     : ${p.propertyName}`,
      `  Unit         : ${p.unitLabel}`,
      `  Reason       : ${p.reason}`,
      ``,
      p.revisedBidUrl
        ? `If you can offer a revised price or availability, send it here: ${p.revisedBidUrl}`
        : `No further action is needed for this work order unless the property manager contacts you again.`,
    ].join('\n'),
    html: htmlEmail(`
      <p style="margin:0 0 14px 0">Hi ${esc(p.vendorName)},</p>
      <p style="margin:0 0 14px 0">The property manager canceled your selection for this work order.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:14px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Property', p.propertyName)}
        ${dtRow('Unit', p.unitLabel)}
        ${dtRow('Reason', p.reason)}
      </table>
      ${p.revisedBidUrl
        ? `${actionButton('Send revised bid', p.revisedBidUrl)}<p style="margin:14px 0 0 0">Use this only if you can offer a revised price or availability for this same work order.</p>`
        : '<p style="margin:14px 0 0 0">No further action is needed for this work order unless the property manager contacts you again.</p>'}
    `),
    requestId: p.requestId,
    actionUrl: p.revisedBidUrl,
  }
}

export interface VendorOverdueUpdateParams {
  requestId: string
  title: string
  propertyName: string
  unitLabel: string
  vendorName: string
  vendorEmail: string
  scheduledEnd?: string
  actionUrl?: string
}

export function buildVendorOverdueUpdateMessage(p: VendorOverdueUpdateParams): NotificationMessage {
  const dueLine = p.scheduledEnd ? formatAppointmentDateTime(p.scheduledEnd) : 'the scheduled completion time'
  return {
    to: p.vendorEmail,
    subject: `Update overdue - ${p.title}`,
    text: [
      `Hi ${p.vendorName},`,
      ``,
      `This work order needs an update. The scheduled appointment time passed at ${dueLine}.`,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Property     : ${p.propertyName}`,
      `  Unit         : ${p.unitLabel}`,
      ``,
      p.actionUrl ? `Send update: ${p.actionUrl}` : 'Please sign in to the vendor portal and send an update.',
    ].filter(Boolean).join('\n'),
    html: htmlEmail(`
      <p style="margin:0 0 14px 0">Hi ${esc(p.vendorName)},</p>
      <p style="margin:0 0 14px 0">This work order needs an update. The scheduled appointment time passed at ${esc(dueLine)}.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:14px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Property', p.propertyName)}
        ${dtRow('Unit', p.unitLabel)}
      </table>
      ${actionButton('Send update', p.actionUrl)}
      ${p.actionUrl ? '' : '<p style="margin:14px 0 0 0">Please sign in to the vendor portal and send an update.</p>'}
    `),
    requestId: p.requestId,
    actionUrl: p.actionUrl,
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
  actionUrl?: string
}

export interface TenantQueueViewedParams {
  requestId: string
  title: string
  propertyName: string
  unitLabel: string
  tenantEmail: string
  tenantName: string
  actionUrl?: string
}

export interface TenantCommentNotificationParams {
  requestId: string
  title: string
  propertyName: string
  unitLabel: string
  tenantEmail: string
  tenantName: string
  comment: string
  actionUrl?: string
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
  actionUrl?: string
}

export function buildTenantVendorUpdateMessage(p: TenantVendorUpdateParams): NotificationMessage {
  const scheduleLine = p.scheduledStart ? formatAppointmentWindow(p.scheduledStart, p.scheduledEnd) : ''
  const isScheduled = p.dispatchStatus === 'scheduled' && Boolean(scheduleLine)
  const headline = isScheduled
    ? 'Your maintenance work has been scheduled.'
    : 'Your maintenance request has a vendor update.'
  const subject = isScheduled
    ? `Maintenance work scheduled - ${p.title}`
    : `Vendor update for your maintenance request - ${p.title}`

  return {
    to: p.tenantEmail,
    subject,
    text: [
      `Hi ${p.tenantName},`,
      ``,
      headline,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Unit         : ${p.unitLabel} - ${p.propertyName}`,
      `  Vendor       : ${p.vendorName}`,
      `  Dispatch     : ${p.dispatchStatus}`,
      scheduleLine ? `  Schedule     : ${scheduleLine}` : '',
      p.photoCount ? `  Photos       : ${p.photoCount} new photo${p.photoCount === 1 ? '' : 's'}` : '',
      p.note ? `Note: ${p.note}` : '',
      p.actionUrl ? `Open request: ${p.actionUrl}` : '',
    ].filter(Boolean).join('\n'),
    html: htmlEmail(`
      <p style="margin:0 0 14px 0">Hi ${esc(p.tenantName)},</p>
      <p style="margin:0 0 14px 0">${esc(headline)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:14px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Unit', `${p.unitLabel} - ${p.propertyName}`)}
        ${dtRow('Vendor', p.vendorName)}
        ${dtRow('Dispatch', p.dispatchStatus)}
        ${scheduleLine ? dtRow('Schedule', scheduleLine) : ''}
        ${p.photoCount ? dtRow('Photos', `${p.photoCount} new photo${p.photoCount === 1 ? '' : 's'}`) : ''}
      </table>
      ${p.note ? `<p style="margin:14px 0 0 0"><strong>Note:</strong> ${esc(p.note)}</p>` : ''}
      ${actionButton('Open request', p.actionUrl)}
    `),
    requestId: p.requestId,
    actionUrl: p.actionUrl,
  }
}

export function buildTenantQueueViewedMessage(p: TenantQueueViewedParams): NotificationMessage {
  return {
    to: p.tenantEmail,
    subject: `Your maintenance request is now being reviewed - ${p.title}`,
    text: [
      `Hi ${p.tenantName},`,
      ``,
      `A property manager has opened your maintenance request and it is now being reviewed.`,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Unit         : ${p.unitLabel} - ${p.propertyName}`,
      ``,
      p.actionUrl ? `Open request: ${p.actionUrl}` : '',
      p.actionUrl ? `` : '',
      `We'll send another update when scheduling or work status changes.`,
    ].filter((line, index, lines) => line !== '' || lines[index - 1] !== '').join('\n'),
    html: htmlEmail(`
      <p style="margin:0 0 14px 0">Hi ${esc(p.tenantName)},</p>
      <p style="margin:0 0 14px 0">A property manager has opened your maintenance request and it is now being reviewed.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:14px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Unit', `${p.unitLabel} - ${p.propertyName}`)}
      </table>
      ${actionButton('Open request', p.actionUrl)}
      <p style="margin:14px 0 0 0">We&rsquo;ll send another update when scheduling or work status changes.</p>
    `),
    requestId: p.requestId,
    actionUrl: p.actionUrl,
  }
}

export function buildTenantCommentMessage(p: TenantCommentNotificationParams): NotificationMessage {
  return {
    to: p.tenantEmail,
    subject: `New message on your maintenance request - ${p.title}`,
    text: [
      `Hi ${p.tenantName},`,
      ``,
      `There is a new message on your maintenance request.`,
      ``,
      `  Reference ID : ${p.requestId}`,
      `  Issue        : ${p.title}`,
      `  Unit         : ${p.unitLabel} - ${p.propertyName}`,
      ``,
      `Message:`,
      p.comment,
      ``,
      p.actionUrl ? `Open request: ${p.actionUrl}` : '',
    ].filter((line, index, lines) => line !== '' || lines[index - 1] !== '').join('\n'),
    html: htmlEmail(`
      <p style="margin:0 0 14px 0">Hi ${esc(p.tenantName)},</p>
      <p style="margin:0 0 14px 0">There is a new message on your maintenance request.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:14px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${dtRow('Reference ID', p.requestId)}
        ${dtRow('Issue', p.title)}
        ${dtRow('Unit', `${p.unitLabel} - ${p.propertyName}`)}
      </table>
      <p style="margin:14px 0 8px 0;font-weight:bold">Message</p>
      <p style="margin:0;background-color:#f9fafb;border-left:4px solid #1a56db;padding:12px 16px">${escLines(p.comment)}</p>
      ${actionButton('Open request', p.actionUrl)}
    `),
    requestId: p.requestId,
    actionUrl: p.actionUrl,
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
    actionUrl?: string
  }>
  actionUrl?: string
}

export function buildLandlordExceptionSummaryMessage(p: LandlordExceptionSummaryParams): NotificationMessage {
  return {
    to: p.landlordEmail,
    subject: `[Mission Control] Daily exception summary`,
    text: [
      `Daily exception summary`,
      ``,
      ...p.requests.map((request) =>
        `- ${request.title} (${request.propertyName} / ${request.unitLabel}) - flag=${request.autoFlag ?? 'none'} - review=${request.reviewState ?? 'none'}${request.actionUrl ? ` - ${request.actionUrl}` : ''}`,
      ),
    ].join('\n'),
    html: htmlEmail(`
      <p style="margin:0 0 14px 0"><strong>Daily exception summary</strong></p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:14px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${p.requests.map((request) => `
          <tr>
            <td style="padding:8px 12px 8px 0;vertical-align:top;color:#111827;font-size:14px;line-height:20px;font-family:Arial,Helvetica,sans-serif;overflow-wrap:break-word">${request.actionUrl ? `<a href="${esc(request.actionUrl)}" style="color:#1a56db;text-decoration:underline">${esc(request.title)}</a>` : esc(request.title)}</td>
            <td style="padding:8px 12px 8px 0;vertical-align:top;color:#6b7280;font-size:14px;line-height:20px;font-family:Arial,Helvetica,sans-serif;overflow-wrap:break-word">${esc(`${request.propertyName} / ${request.unitLabel}`)}</td>
            <td style="padding:8px 12px 8px 0;vertical-align:top;color:#6b7280;font-size:14px;line-height:20px;font-family:Arial,Helvetica,sans-serif;overflow-wrap:break-word">${esc(request.autoFlag ?? 'none')}</td>
            <td style="padding:8px 0;vertical-align:top;color:#6b7280;font-size:14px;line-height:20px;font-family:Arial,Helvetica,sans-serif;overflow-wrap:break-word">${esc(request.reviewState ?? 'none')}</td>
          </tr>
        `).join('')}
      </table>
      ${actionButton('Open exceptions', p.actionUrl)}
    `),
    actionUrl: p.actionUrl,
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
      ``,
      p.actionUrl ? `Open details: ${p.actionUrl}` : '',
    ].filter((line, index, lines) => line !== '' || lines[index - 1] !== '').join('\n'),
    html: htmlEmail(`
      <p style="margin:0 0 14px 0">${esc(p.title)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:14px 0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt">
        ${dtRow('Recipient', p.recipientLabel)}
        ${dtRow('Type', p.documentType)}
        ${dtRow('Status', p.status)}
        ${dtRow('Amount', p.amountLabel)}
        ${dtRow('Paid', p.paidLabel)}
        ${dtRow('Balance', p.balanceLabel)}
      </table>
      ${actionButton('Open details', p.actionUrl)}
    `),
    actionUrl: p.actionUrl,
  }
}
