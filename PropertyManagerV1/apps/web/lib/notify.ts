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

import type { RequestStatus } from '@/lib/types'

export interface NotificationMessage {
  to: string
  subject: string
  text: string
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
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Dispatch a notification. Never throws — transport failures are caught and
 * logged so callers don't need try/catch around notification calls.
 */
export async function sendNotification(msg: NotificationMessage): Promise<void> {
  try {
    if (process.env.NOTIFY_TRANSPORT === 'smtp') {
      await sendViaSmtp(msg)
    } else {
      sendViaLog(msg)
    }
  } catch (err) {
    console.error('[NOTIFY] Transport error — notification was not delivered:', err)
  }
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
      ``,
      `We'll be in touch once a vendor is scheduled. Reply to this email if you have questions.`,
    ].join('\n'),
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
      `  Tenant       : ${p.tenantName} <${p.tenantEmail}>`,
      ``,
      `Description:`,
      p.description,
    ].join('\n'),
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
      p.toStatus === 'done'
        ? 'The work is complete. Please reply if you have any concerns.'
        : 'We\'ll keep you updated as the work progresses.',
    ].join('\n'),
  }
}
