import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

describe('AppointmentDateTimeFields', () => {
  test('posts visible date and time inputs without empty controlled values', () => {
    const source = readFileSync(resolve(process.cwd(), 'components', 'appointment-date-time-fields.tsx'), 'utf8')

    expect(source).toContain('name="appointmentStartDate"')
    expect(source).toContain('name="appointmentStartTime"')
    expect(source).toContain('name="appointmentEndDate"')
    expect(source).toContain('name="appointmentEndTime"')
    expect(source).not.toContain('useState')
    expect(source).not.toContain('value={')
  })
})
