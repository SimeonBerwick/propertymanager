import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notify'
import { getAppBaseUrl } from '@/lib/runtime-env'

const DAY_MS = 86_400_000

export type TrialReminderKind = 'seven_day' | 'two_day'

export function dueTrialReminder(trialEndsAt: Date, now = new Date()): TrialReminderKind | null {
  const remaining = trialEndsAt.getTime() - now.getTime()
  if (remaining <= 0) return null
  if (remaining <= 2 * DAY_MS) return 'two_day'
  if (remaining <= 7 * DAY_MS) return 'seven_day'
  return null
}

function reminderField(kind: TrialReminderKind) {
  return kind === 'seven_day' ? 'trialReminder7SentAt' as const : 'trialReminder2SentAt' as const
}

export async function sendDueTrialEndingReminders(now = new Date()) {
  const trials = await prisma.user.findMany({
    where: {
      role: 'landlord',
      subscriptionStatus: 'trialing',
      trialProgram: { not: 'none' },
      trialEndsAt: { gt: now, lte: new Date(now.getTime() + 7 * DAY_MS) },
      OR: [{ trialReminder7SentAt: null }, { trialReminder2SentAt: null }],
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      trialProgram: true,
      trialEndsAt: true,
      trialReminder7SentAt: true,
      trialReminder2SentAt: true,
    },
  }).catch(() => [])

  let sent = 0
  let skipped = 0
  let failed = 0
  for (const trial of trials) {
    if (!trial.trialEndsAt) { skipped += 1; continue }
    const kind = dueTrialReminder(trial.trialEndsAt, now)
    if (!kind) { skipped += 1; continue }
    const field = reminderField(kind)
    if (trial[field]) { skipped += 1; continue }

    const claimed = await prisma.user.updateMany({
      where: { id: trial.id, subscriptionStatus: 'trialing', [field]: null },
      data: { [field]: now },
    })
    if (!claimed.count) { skipped += 1; continue }

    const days = kind === 'seven_day' ? 7 : 2
    const assisted = trial.trialProgram === 'assisted_us_30'
    const accountUrl = `${getAppBaseUrl('trial ending reminders')}/account/subscription`
    const result = await sendNotification({
      to: trial.email,
      subject: `${days} days left on your Simeonware trial`,
      text: [
        `Hi ${trial.displayName ?? 'there'},`,
        '',
        `Your ${assisted ? 'assisted ' : ''}trial ends on ${trial.trialEndsAt.toISOString()}.`,
        'No payment method is on file and you will not be charged automatically.',
        '',
        'To continue after the trial, review the exact plan price and authorize a paid subscription:',
        accountUrl,
        '',
        'If you do nothing, manager access will pause when the trial ends and no charge will be made.',
      ].join('\n'),
      actionUrl: accountUrl,
    }, { ownerUserId: trial.id, bypassUserPreference: true, transportHint: 'system' })

    if (result.ok) sent += 1
    else {
      failed += 1
      await prisma.user.updateMany({ where: { id: trial.id, [field]: now }, data: { [field]: null } }).catch(() => null)
    }
  }

  return { ok: failed === 0, processed: trials.length, sent, skipped, deliveryFailureCount: failed }
}
