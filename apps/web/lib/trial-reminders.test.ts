import { describe, expect, test } from 'vitest'
import { dueTrialReminder } from './trial-reminders'

const NOW = new Date('2030-01-01T12:00:00Z')

describe('trial ending reminder timing', () => {
  test('selects the seven-day reminder during the first reminder window', () => {
    expect(dueTrialReminder(new Date('2030-01-08T12:00:00Z'), NOW)).toBe('seven_day')
    expect(dueTrialReminder(new Date('2030-01-04T12:00:00Z'), NOW)).toBe('seven_day')
  })

  test('selects the two-day reminder closest to expiration', () => {
    expect(dueTrialReminder(new Date('2030-01-03T12:00:00Z'), NOW)).toBe('two_day')
    expect(dueTrialReminder(new Date('2030-01-01T12:00:01Z'), NOW)).toBe('two_day')
  })

  test('does not send before the window or after expiration', () => {
    expect(dueTrialReminder(new Date('2030-01-08T12:00:01Z'), NOW)).toBeNull()
    expect(dueTrialReminder(NOW, NOW)).toBeNull()
  })
})
