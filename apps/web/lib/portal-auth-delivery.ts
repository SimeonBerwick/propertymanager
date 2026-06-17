import { sendNotification } from '@/lib/notify'

export type PortalRole = 'tenant' | 'vendor'
export type AuthDeliveryChannel = 'email' | 'sms'

export function isSmsDeliveryConfigured() {
  return process.env.SMS_TRANSPORT === 'twilio'
    && Boolean(process.env.TWILIO_ACCOUNT_SID)
    && Boolean(process.env.TWILIO_AUTH_TOKEN)
    && Boolean(process.env.TWILIO_FROM_NUMBER)
}

async function sendSms(to: string, body: string) {
  if (!isSmsDeliveryConfigured()) {
    throw new Error('SMS sign-in is not configured. Use email instead.')
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const auth = Buffer.from(`${accountSid}:${process.env.TWILIO_AUTH_TOKEN!}`).toString('base64')
  const payload = new URLSearchParams({
    To: to,
    From: process.env.TWILIO_FROM_NUMBER!,
    Body: body,
  })
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload,
  })

  if (!response.ok) {
    throw new Error(`SMS delivery failed with status ${response.status}.`)
  }
}

export async function sendPortalAuthChallenge(input: {
  role: PortalRole
  channel: AuthDeliveryChannel
  to: string
  recipientName: string
  code: string
  magicLink: string
}) {
  const portalLabel = input.role === 'tenant' ? 'tenant portal' : 'vendor portal'
  const text = [
    `Hi ${input.recipientName},`,
    '',
    `Use this login link to open the ${portalLabel}:`,
    input.magicLink,
    '',
    `Or enter this code: ${input.code}`,
    'The link and code expire after 10 minutes and can only be used once.',
    '',
    'If you did not request this, contact your property manager.',
  ].join('\n')

  if (input.channel === 'sms') {
    await sendSms(input.to, `${portalLabel}: ${input.magicLink} Code: ${input.code}. Expires in 10 minutes.`)
    return
  }

  const result = await sendNotification({
    to: input.to,
    subject: `Your ${portalLabel} login link`,
    text,
  })
  if (!result.ok) throw new Error('Email delivery failed. Try again.')
}
