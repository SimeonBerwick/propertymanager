const DISPLAY_TIME_ZONE = process.env.NEXT_PUBLIC_DISPLAY_TIME_ZONE || 'America/Phoenix'

function timeZoneOffsetMinutes(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(date)
  const value = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  const match = value.match(/^GMT(?:(?<sign>[+-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?)?$/)
  if (!match?.groups?.sign) return 0
  const hours = Number(match.groups.hours)
  const minutes = Number(match.groups.minutes ?? '0')
  const total = hours * 60 + minutes
  return match.groups.sign === '-' ? -total : total
}

export function parseDateTimeLocalInDisplayTimeZone(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null
  const [, year, month, day, hour, minute, second = '0'] = match
  const utcGuess = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ))
  const offset = timeZoneOffsetMinutes(DISPLAY_TIME_ZONE, utcGuess)
  return new Date(utcGuess.getTime() - offset * 60 * 1000)
}

export function formatAppointmentDateTime(value?: Date | string | null) {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: DISPLAY_TIME_ZONE,
  }).format(new Date(value))
}

export function formatAppointmentWindow(start?: Date | string | null, end?: Date | string | null) {
  if (!start) return 'Not scheduled'
  const startLabel = formatAppointmentDateTime(start)
  return end ? `${startLabel} to ${formatAppointmentDateTime(end)}` : startLabel
}
