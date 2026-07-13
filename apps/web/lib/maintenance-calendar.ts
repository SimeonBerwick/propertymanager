export type CalendarEventKind = 'appointment' | 'inspection' | 'turn_target' | 'turn_task'

export type MaintenanceCalendarEvent = {
  id: string
  kind: CalendarEventKind
  title: string
  start: Date
  end: Date | null
  href: string
  propertyId: string
  propertyName: string
  unitLabel: string
  vendorId: string | null
  vendorName: string | null
  status: string
  overdue: boolean
}

type CalendarData = {
  requests: Array<{ id: string; title: string; status: string; vendorScheduledStart: Date | null; vendorScheduledEnd: Date | null; assignedVendorId: string | null; assignedVendorName: string | null; unit: { label: string; property: { id: string; name: string } } }>
  inspections: Array<{ id: string; title: string; status: string; dueAt: Date | null; unit: { label: string; property: { id: string; name: string } } }>
  turns: Array<{ id: string; title: string; status: string; targetMoveInAt: Date | null; unit: { label: string; property: { id: string; name: string } }; tasks: Array<{ id: string; title: string; status: string; dueAt: Date | null; assignedVendorId: string | null; assignedVendor: { name: string } | null }> }>
}

export function buildMaintenanceCalendarEvents(data: CalendarData, now = new Date()) {
  const events: MaintenanceCalendarEvent[] = []
  for (const request of data.requests) {
    if (!request.vendorScheduledStart) continue
    events.push({ id: `request:${request.id}`, kind: 'appointment', title: request.title, start: request.vendorScheduledStart, end: request.vendorScheduledEnd, href: `/requests/${request.id}`, propertyId: request.unit.property.id, propertyName: request.unit.property.name, unitLabel: request.unit.label, vendorId: request.assignedVendorId, vendorName: request.assignedVendorName, status: request.status, overdue: Boolean(request.vendorScheduledEnd && request.vendorScheduledEnd < now && !['completed', 'closed', 'declined', 'canceled'].includes(request.status)) })
  }
  for (const inspection of data.inspections) {
    if (!inspection.dueAt) continue
    events.push({ id: `inspection:${inspection.id}`, kind: 'inspection', title: inspection.title, start: inspection.dueAt, end: null, href: `/inspections/${inspection.id}`, propertyId: inspection.unit.property.id, propertyName: inspection.unit.property.name, unitLabel: inspection.unit.label, vendorId: null, vendorName: null, status: inspection.status, overdue: inspection.status !== 'completed' && inspection.dueAt < now })
  }
  for (const turn of data.turns) {
    if (turn.targetMoveInAt) events.push({ id: `turn:${turn.id}`, kind: 'turn_target', title: `${turn.title} target`, start: turn.targetMoveInAt, end: null, href: `/turns/${turn.id}`, propertyId: turn.unit.property.id, propertyName: turn.unit.property.name, unitLabel: turn.unit.label, vendorId: null, vendorName: null, status: turn.status, overdue: turn.status !== 'ready' && turn.targetMoveInAt < now })
    for (const task of turn.tasks) {
      if (!task.dueAt) continue
      events.push({ id: `turn-task:${task.id}`, kind: 'turn_task', title: task.title, start: task.dueAt, end: null, href: `/turns/${turn.id}`, propertyId: turn.unit.property.id, propertyName: turn.unit.property.name, unitLabel: turn.unit.label, vendorId: task.assignedVendorId, vendorName: task.assignedVendor?.name ?? null, status: task.status, overdue: task.status !== 'completed' && task.dueAt < now })
    }
  }
  return events.sort((a, b) => a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title))
}

export function parseCalendarDate(value: string | undefined, fallback = new Date()) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), fallback.getUTCDate(), 12))
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

export function calendarDateParam(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function calendarEventDateKey(date: Date, timeZone = process.env.NEXT_PUBLIC_DISPLAY_TIME_ZONE || 'America/Phoenix') {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function calendarDays(anchor: Date, view: 'month' | 'week') {
  const start = new Date(anchor)
  if (view === 'month') start.setUTCDate(1)
  start.setUTCDate(start.getUTCDate() - start.getUTCDay())
  const count = view === 'month' ? 42 : 7
  return Array.from({ length: count }, (_, index) => { const date = new Date(start); date.setUTCDate(start.getUTCDate() + index); return date })
}

export function shiftCalendarDate(anchor: Date, view: 'month' | 'week' | 'agenda', direction: -1 | 1) {
  const next = new Date(anchor)
  if (view === 'month') next.setUTCMonth(next.getUTCMonth() + direction)
  else next.setUTCDate(next.getUTCDate() + direction * (view === 'week' ? 7 : 30))
  return next
}
