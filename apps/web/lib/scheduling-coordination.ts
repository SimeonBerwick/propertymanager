export type SchedulingPolicy = {
  enabled: boolean
  autoConfirm: boolean
  workingHourStart: number
  workingHourEnd: number
  minimumNoticeHours: number
  defaultDurationMinutes: number
  proposalExpiryHours: number
}

export function resolveSchedulingPolicy(account: {
  schedulingCoordinationEnabled: boolean
  schedulingAutoConfirmEnabled: boolean
  schedulingWorkingHourStart: number
  schedulingWorkingHourEnd: number
  schedulingMinimumNoticeHours: number
  schedulingDefaultDurationMinutes: number
  schedulingProposalExpiryHours: number
}, override?: boolean | null): SchedulingPolicy {
  return { enabled: override ?? account.schedulingCoordinationEnabled, autoConfirm: account.schedulingAutoConfirmEnabled, workingHourStart: account.schedulingWorkingHourStart, workingHourEnd: account.schedulingWorkingHourEnd, minimumNoticeHours: account.schedulingMinimumNoticeHours, defaultDurationMinutes: account.schedulingDefaultDurationMinutes, proposalExpiryHours: account.schedulingProposalExpiryHours }
}

export function appointmentSlotsFromStarts(starts: Array<Date | null>, durationMinutes: number) {
  const durationMs = durationMinutes * 60_000
  return starts
    .filter((start): start is Date => start !== null)
    .map((startAt) => ({ startAt, endAt: new Date(startAt.getTime() + durationMs) }))
}

export function validateProposedSlots(slots: Array<{ startAt: Date; endAt: Date }>, policy: SchedulingPolicy, now = new Date()) {
  if (!policy.enabled) return 'Direct scheduling is disabled for this request.'
  if (!slots.length || slots.length > 3) return 'Offer between one and three appointment times.'
  const earliest = now.getTime() + policy.minimumNoticeHours * 3_600_000
  for (const slot of slots) {
    if (!Number.isFinite(slot.startAt.getTime()) || !Number.isFinite(slot.endAt.getTime())) return 'Enter valid appointment times.'
    if (slot.startAt.getTime() < earliest) return `Appointment times require at least ${policy.minimumNoticeHours} hours notice.`
    if (slot.endAt <= slot.startAt) return 'Each appointment end must be after its start.'
    const hour = (date: Date) => { const parts = new Intl.DateTimeFormat('en-US', { timeZone: process.env.NEXT_PUBLIC_DISPLAY_TIME_ZONE || 'America/Phoenix', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date); return Number(parts.find((part) => part.type === 'hour')?.value ?? 0) + Number(parts.find((part) => part.type === 'minute')?.value ?? 0) / 60 }
    const startHour = hour(slot.startAt)
    const endHour = hour(slot.endAt)
    if (startHour < policy.workingHourStart || endHour > policy.workingHourEnd) return `Appointment times must stay between ${policy.workingHourStart}:00 and ${policy.workingHourEnd}:00.`
  }
  const starts = new Set(slots.map((slot) => slot.startAt.getTime()))
  if (starts.size !== slots.length) return 'Appointment times must be different.'
  const ordered = [...slots].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].startAt < ordered[index - 1].endAt) return 'Appointment choices cannot overlap each other.'
  }
  return null
}

export function schedulingReminderIsDue(lastReminderAt: Date | null | undefined, now = new Date()) {
  return !lastReminderAt || now.getTime() - lastReminderAt.getTime() >= 24 * 3_600_000
}

export function appointmentProposalHasExpired(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() <= now.getTime()
}
