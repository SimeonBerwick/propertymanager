/**
 * SMS transport layer.
 *
 * Transports (controlled by SMS_TRANSPORT env var):
 *   unset / "log" — writes to stdout; safe dev default, zero config required.
 *   "twilio"      — sends SMS via Twilio REST API.
 *                   Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 *
 * SMS delivery is best-effort: transport errors are logged but never
 * propagate back to the caller so a failed SMS never breaks a user action.
 */

export interface SmsMessage {
  /** Destination phone number in E.164 format, e.g. +16025551212 */
  to: string
  body: string
}

// ── Transports ────────────────────────────────────────────────────────────────

function sendViaLog(msg: SmsMessage): void {
  console.log(
    `\n[SMS] ──────────────────────────────────────\n` +
    `  To:   ${msg.to}\n` +
    `  ─────────────────────────────────────────\n` +
    `  ${msg.body.replace(/\n/g, '\n  ')}\n` +
    `[/SMS] ─────────────────────────────────────\n`,
  )
}

async function sendViaTwilio(msg: SmsMessage): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      'SMS_TRANSPORT=twilio requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.',
    )
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: msg.to, From: fromNumber, Body: msg.body }).toString(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)')
    throw new Error(`Twilio API error ${res.status}: ${text}`)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Dispatch an SMS. Never throws — transport failures are caught and logged
 * so callers don't need try/catch around SMS calls.
 */
export async function sendSms(msg: SmsMessage): Promise<void> {
  try {
    if (process.env.SMS_TRANSPORT === 'twilio') {
      await sendViaTwilio(msg)
    } else {
      sendViaLog(msg)
    }
  } catch (err) {
    console.error('[SMS] Transport error — message was not delivered:', err)
  }
}
