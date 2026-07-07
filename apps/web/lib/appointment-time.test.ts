import { describe, expect, test } from 'vitest'
import { formatAppointmentWindow, parseDateTimeLocalInDisplayTimeZone } from './appointment-time'

describe('appointment time helpers', () => {
  test('parses datetime-local values as app-local appointment times', () => {
    const appointment = parseDateTimeLocalInDisplayTimeZone('2026-07-07T16:30')

    expect(appointment?.toISOString()).toBe('2026-07-07T23:30:00.000Z')
    expect(formatAppointmentWindow(appointment)).toBe('Jul 7, 4:30 PM')
  })

  test('omits the end time when no end time is provided', () => {
    expect(formatAppointmentWindow('2026-07-07T23:30:00.000Z', null)).toBe('Jul 7, 4:30 PM')
  })
})
