import Link from 'next/link'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { buildMaintenanceCalendarEvents, calendarDateParam, calendarDays, calendarEventDateKey, parseCalendarDate, shiftCalendarDate, type CalendarEventKind } from '@/lib/maintenance-calendar'
import { formatAppointmentDateTime } from '@/lib/appointment-time'

const KIND_LABELS: Record<CalendarEventKind, string> = { appointment: 'Appointment', inspection: 'Inspection', turn_target: 'Turn target', turn_task: 'Turn task' }
type Query = { date?: string; view?: string; propertyId?: string; vendorId?: string; kind?: string }

function calendarUrl(query: Query, changes: Partial<Query>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...query, ...changes })) if (value) params.set(key, value)
  return `/calendar?${params.toString()}` as Route
}

export default async function MaintenanceCalendarPage({ searchParams }: { searchParams: Promise<Query> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const query = await searchParams
  const view = query.view === 'week' || query.view === 'agenda' ? query.view : 'month'
  const anchor = parseCalendarDate(query.date)
  const gridDays = view === 'agenda' ? [] : calendarDays(anchor, view)
  const rangeStart = view === 'agenda' ? anchor : gridDays[0]
  const rangeEnd = view === 'agenda' ? new Date(anchor.getTime() + 30 * 86_400_000) : new Date(gridDays.at(-1)!.getTime() + 86_400_000)
  const paddedStart = new Date(rangeStart.getTime() - 86_400_000)
  const paddedEnd = new Date(rangeEnd.getTime() + 86_400_000)
  const [requests, inspections, turns, properties, vendors] = await Promise.all([
    prisma.maintenanceRequest.findMany({
      where: { property: { ownerId: session.userId }, OR: [{ vendorScheduledStart: { gte: paddedStart, lt: paddedEnd } }, { staffScheduledStart: { gte: paddedStart, lt: paddedEnd } }] },
      include: { unit: { include: { property: true } } },
    }),
    prisma.inspection.findMany({
      where: { orgId: session.userId, dueAt: { gte: paddedStart, lt: paddedEnd } },
      include: { unit: { include: { property: true } } },
    }),
    prisma.unitTurn.findMany({
      where: {
        orgId: session.userId,
        OR: [
          { targetMoveInAt: { gte: paddedStart, lt: paddedEnd } },
          { tasks: { some: { dueAt: { gte: paddedStart, lt: paddedEnd } } } },
        ],
      },
      include: {
        unit: { include: { property: true } },
        tasks: {
          where: { dueAt: { gte: paddedStart, lt: paddedEnd } },
          include: { assignedVendor: true },
          orderBy: { dueAt: 'asc' },
        },
      },
    }),
    prisma.property.findMany({ where: { ownerId: session.userId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.vendor.findMany({ where: { orgId: session.userId, isActive: true }, orderBy: { name: 'asc' } }),
  ])
  const agendaStartKey = calendarDateParam(anchor)
  const agendaEndKey = calendarDateParam(rangeEnd)
  const events = buildMaintenanceCalendarEvents({ requests, inspections, turns }).filter((event) => {
    const key = calendarEventDateKey(event.start)
    return (!query.propertyId || event.propertyId === query.propertyId)
      && (!query.vendorId || event.vendorId === query.vendorId)
      && (!query.kind || event.kind === query.kind)
      && (view !== 'agenda' || (key >= agendaStartKey && key < agendaEndKey))
  })
  const byDay = new Map<string, typeof events>()
  for (const event of events) {
    const key = calendarEventDateKey(event.start)
    byDay.set(key, [...(byDay.get(key) ?? []), event])
  }
  const today = calendarEventDateKey(new Date())
  const title = view === 'month'
    ? anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : view === 'week'
      ? `${gridDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} - ${gridDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
      : `Next 30 days from ${anchor.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`

  return <div className="stack">
    <section className="row"><div><div className="kicker">Portfolio schedule</div><h1>Maintenance calendar</h1><p className="muted">Appointments, inspection deadlines, and unit-turn work in one place.</p></div><div className="row"><Link className="button" href="/calendar/preferences">Scheduling preferences</Link><Link className="button" href="/calendar/outlook">Outlook sync</Link><Link className="button primary" href="/dashboard?queue=open">Open work queue</Link></div></section>
    <section className="calendarToolbar"><div className="row"><Link className="button" href={calendarUrl(query, { date: calendarDateParam(shiftCalendarDate(anchor, view, -1)), view })}>Previous</Link><Link className="button" href={calendarUrl(query, { date: calendarDateParam(new Date()), view })}>Today</Link><Link className="button" href={calendarUrl(query, { date: calendarDateParam(shiftCalendarDate(anchor, view, 1)), view })}>Next</Link></div><h2>{title}</h2><div className="row calendarViewControl">{(['month', 'week', 'agenda'] as const).map((item) => <Link key={item} className={`button ${view === item ? 'primary' : ''}`} href={calendarUrl(query, { view: item })}>{item[0].toUpperCase() + item.slice(1)}</Link>)}</div></section>
    <form method="GET" className="calendarFilters"><input type="hidden" name="date" value={calendarDateParam(anchor)} /><input type="hidden" name="view" value={view} /><label>Property<select name="propertyId" defaultValue={query.propertyId ?? ''}><option value="">All properties</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><label>Vendor<select name="vendorId" defaultValue={query.vendorId ?? ''}><option value="">All vendors</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label><label>Event type<select name="kind" defaultValue={query.kind ?? ''}><option value="">All event types</option>{Object.entries(KIND_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label><button className="button" type="submit">Apply filters</button>{query.propertyId || query.vendorId || query.kind ? <Link className="button" href={calendarUrl(query, { propertyId: undefined, vendorId: undefined, kind: undefined })}>Clear</Link> : null}</form>
    {view !== 'agenda' ? <section className={`maintenanceCalendar ${view}`} aria-label={`${view} calendar`}><div className="calendarWeekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day}>{day}</div>)}</div><div className="calendarGrid">{gridDays.map((day) => { const key = calendarDateParam(day); const dayEvents = byDay.get(key) ?? []; const outside = view === 'month' && day.getUTCMonth() !== anchor.getUTCMonth(); return <div className={`calendarDay ${outside ? 'outside' : ''} ${key === today ? 'today' : ''}`} key={key}><div className="calendarDayNumber">{day.getUTCDate()}</div><div className="calendarDayEvents">{dayEvents.map((event) => <Link key={event.id} href={event.href as Route} className={`calendarEvent ${event.kind} ${event.overdue ? 'overdue' : ''}`} title={`${KIND_LABELS[event.kind]}: ${event.propertyName} ${event.unitLabel}`}><strong>{event.kind === 'appointment' ? formatAppointmentDateTime(event.start).split(', ').at(-1) : KIND_LABELS[event.kind]}</strong><span>{event.title}</span><small>{event.propertyName} - {event.unitLabel}</small></Link>)}</div></div>})}</div></section> : <section className="card stack"><h2>Upcoming schedule</h2>{events.length ? <table className="table"><thead><tr><th>Date</th><th>Work</th><th>Property / unit</th><th>Vendor</th><th>Status</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{formatAppointmentDateTime(event.start)}</td><td><Link href={event.href as Route}><strong>{event.title}</strong></Link><div className="muted">{KIND_LABELS[event.kind]}</div></td><td>{event.propertyName}<div className="muted">{event.unitLabel}</div></td><td>{event.vendorName ?? '-'}</td><td><span className={`badge ${event.overdue ? 'dangerText' : ''}`}>{event.overdue ? 'Overdue' : event.status.replaceAll('_', ' ')}</span></td></tr>)}</tbody></table> : <div className="emptyState"><strong>No scheduled work in this period</strong><span>There are no events matching the current filters.</span></div>}</section>}
  </div>
}
