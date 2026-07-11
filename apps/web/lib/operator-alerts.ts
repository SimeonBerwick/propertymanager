import { sendNotification } from '@/lib/notify'

export async function sendOperatorFailureAlert(area: string, details: unknown) {
  const to = process.env.OPS_ALERT_EMAIL?.trim()
  if (!to) return { ok: false, skipped: true }
  const text = typeof details === 'string' ? details : JSON.stringify(details, null, 2)
  return sendNotification({
    to,
    subject: `[Simeonware alert] ${area} needs attention`,
    text: [`A hosted background check reported a problem.`, '', `Area: ${area}`, '', text.slice(0, 6000)].join('\n'),
  }, { bypassUserPreference: true })
}

export function resultHasFailures(value: unknown) {
  if (!value) return false
  const serialized = JSON.stringify(value).toLowerCase()
  return serialized.includes('"error"') || serialized.includes('"failed"') || serialized.includes('"ok":false')
}
