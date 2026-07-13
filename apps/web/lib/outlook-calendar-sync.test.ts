import { describe, expect, it } from 'vitest'
import { buildOutlookEventPayload, hasOutlookCalendarScope, outlookPayloadHash } from '@/lib/outlook-calendar-sync'
import type { MaintenanceCalendarEvent } from '@/lib/maintenance-calendar'

const event: MaintenanceCalendarEvent = { id: 'request:r1', kind: 'appointment', title: 'Leak <repair>', start: new Date('2026-07-14T16:00:00Z'), end: new Date('2026-07-14T17:00:00Z'), href: '/requests/r1', propertyId: 'p1', propertyName: 'Elm & Oak', unitLabel: '2A', vendorId: 'v1', vendorName: 'Plumber', status: 'scheduled', overdue: false }

describe('Outlook calendar sync', () => {
  it('detects the required delegated calendar scope', () => {
    expect(hasOutlookCalendarScope('Mail.Read Calendars.ReadWrite offline_access')).toBe(true)
    expect(hasOutlookCalendarScope('Mail.Read')).toBe(false)
  })
  it('builds a timed event with a stable id and escaped body', () => {
    const payload = buildOutlookEventPayload(event, 'https://app.example.com')
    expect(payload.isAllDay).toBe(false)
    expect(payload.transactionId).toBe('simeonware:request:r1')
    expect(payload.body.content).toContain('Elm &amp; Oak')
    expect(payload.body.content).not.toContain('Leak <repair>')
    expect(outlookPayloadHash(payload)).toBe(outlookPayloadHash(payload))
  })
  it('uses all-day free events for inspection and turn deadlines', () => {
    const payload = buildOutlookEventPayload({ ...event, kind: 'inspection', end: null }, 'https://app.example.com')
    expect(payload.isAllDay).toBe(true)
    expect(payload.showAs).toBe('free')
    expect(payload.end.dateTime).toContain('2026-07-15')
  })
})
