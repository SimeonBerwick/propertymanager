/**
 * SMS transport layer.
 *
 * Transports (controlled by SMS_TRANSPORT env var):
 *   unset / "log" — writes to stdout; safe dev default, zero config required.
 *   "twilio"      — sends SMS via Twilio REST API.
 *                   Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either
 *                   TWILIO_FROM_NUMBER (direct number) or TWILIO_MESSAGING_SERVICE_SID
 *                   (Messaging Service). Exactly one of the two sender params must be set.
 *
 * Adding a new provider: implement SmsTransport, register in resolveTransport().
 *
 * SMS delivery is best-effort: transport errors are logged but never propagate
 * back to the caller so a failed SMS never breaks a user action.
 */

export interface SmsMessage {
  /** Destination phone number in E.164 format, e.g. +16025551212 */
  to: string
  body: string
}

// ── Transport interface ────────────────────────────────────────────────────────

interface SmsTransport {
  send(msg: SmsMessage): Promise<void>
}

// ── Log transport ──────────────────────────────────────────────────────────────

class LogTransport implements SmsTransport {
  async send(msg: SmsMessage): Promise<void> {
    console.log(
      `\n[SMS] ──────────────────────────────────────\n` +
      `  To:   ${msg.to}\n` +
      `  ─────────────────────────────────────────\n` +
      `  ${msg.body.replace(/\n/g, '\n  ')}\n` +
      `[/SMS] ─────────────────────────────────────\n`,
    )
  }
}

// ── Twilio transport ───────────────────────────────────────────────────────────

class TwilioTransport implements SmsTransport {
  async send(msg: SmsMessage): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_FROM_NUMBER
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID

    if (!accountSid || !authToken) {
      throw new Error('SMS_TRANSPORT=twilio requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.')
    }
    if (!fromNumber && !messagingServiceSid) {
      throw new Error(
        'SMS_TRANSPORT=twilio requires either TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID.',
      )
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const params: Record<string, string> = { To: msg.to, Body: msg.body }
    if (fromNumber) {
      params.From = fromNumber
    } else {
      // messagingServiceSid is guaranteed non-null here by the check above
      params.MessagingServiceSid = messagingServiceSid!
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '(no body)')
      throw new Error(`Twilio API error ${res.status}: ${text}`)
    }
  }
}

// ── Transport registry ─────────────────────────────────────────────────────────

function resolveTransport(): SmsTransport {
  switch (process.env.SMS_TRANSPORT) {
    case 'twilio':
      return new TwilioTransport()
    default:
      return new LogTransport()
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Dispatch an SMS. Never throws — transport failures are caught and logged
 * so callers don't need try/catch around SMS calls.
 */
export async function sendSms(msg: SmsMessage): Promise<void> {
  try {
    await resolveTransport().send(msg)
  } catch (err) {
    console.error('[SMS] Transport error — message was not delivered:', err)
  }
}
