import { describe, expect, it } from 'vitest'
import { buildMaintenanceCalendarEvents, calendarDays, parseCalendarDate, shiftCalendarDate } from '@/lib/maintenance-calendar'

describe('maintenance calendar', () => {
  it('combines appointments, inspections, targets, and tasks with overdue state', () => {
    const unit = { label: '2A', property: { id: 'p1', name: 'Elm Court' } }
    const events = buildMaintenanceCalendarEvents({
      requests: [{ id: 'r1', title: 'Leak', status: 'scheduled', vendorScheduledStart: new Date('2026-07-01'), vendorScheduledEnd: new Date('2026-07-01T02:00:00Z'), assignedVendorId: 'v1', assignedVendorName: 'Plumber', unit }],
      inspections: [{ id: 'i1', title: 'Routine', status: 'draft', dueAt: new Date('2026-07-02'), unit }],
      turns: [{ id: 't1', title: 'Unit turn', status: 'in_progress', targetMoveInAt: new Date('2026-07-04'), unit, tasks: [{ id: 'tt1', title: 'Clean', status: 'completed', dueAt: new Date('2026-07-03'), assignedVendorId: null, assignedVendor: null }] }],
    }, new Date('2026-07-05'))
    expect(events.map((event) => event.kind)).toEqual(['appointment', 'inspection', 'turn_task', 'turn_target'])
    expect(events.find((event) => event.kind === 'appointment')?.overdue).toBe(true)
    expect(events.find((event) => event.kind === 'turn_task')?.overdue).toBe(false)
  })
  it('creates stable month and week grids and navigation dates', () => {
    const anchor = parseCalendarDate('2026-07-15')
    expect(calendarDays(anchor, 'month')).toHaveLength(42)
    expect(calendarDays(anchor, 'week')).toHaveLength(7)
    expect(shiftCalendarDate(anchor, 'week', 1).toISOString()).toContain('2026-07-22')
    expect(parseCalendarDate('bad', new Date('2026-01-02T00:00:00Z')).toISOString()).toContain('2026-01-02')
  })
  it('publishes in-house staff appointments when no vendor appointment exists', () => {
    const unit = { label: '2A', property: { id: 'p1', name: 'Elm Court' } }
    const [event] = buildMaintenanceCalendarEvents({ requests: [{ id: 'r2', title: 'Install lock', status: 'scheduled', vendorScheduledStart: null, vendorScheduledEnd: null, staffScheduledStart: new Date('2026-07-06T16:00:00Z'), staffScheduledEnd: new Date('2026-07-06T18:00:00Z'), assignedVendorId: null, assignedVendorName: null, assignedStaffName: 'Alex', unit }], inspections: [], turns: [] })
    expect(event).toMatchObject({ kind: 'appointment', vendorName: 'Alex' })
  })
})
