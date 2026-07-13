import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { formatDateTime } from '@/lib/ui-utils'
import { hasOutlookCalendarScope, listOutlookCalendars } from '@/lib/outlook-calendar-sync'
import { saveOutlookCalendarSettingsAction, stopOutlookCalendarSyncAction, syncOutlookCalendarAction } from './actions'

type Query = { saved?: string; synced?: string; stopped?: string; error?: string; mailbox?: string }

export default async function OutlookCalendarPage({ searchParams }: { searchParams: Promise<Query> }) {
  const session = await getLandlordSession(); if (!session) redirect('/login?error=session-expired')
  const [connection, query] = await Promise.all([
    prisma.mailboxConnection.findFirst({ where: { userId: session.userId, provider: 'outlook' }, include: { _count: { select: { outlookCalendarEvents: true } } } }), searchParams,
  ])
  const hasScope = connection?.status === 'connected' && hasOutlookCalendarScope(connection.scopesCsv)
  let calendars: Awaited<ReturnType<typeof listOutlookCalendars>> = []
  let calendarLoadError = ''
  if (connection && hasScope) {
    try { calendars = await listOutlookCalendars(connection.id) } catch (error) { calendarLoadError = error instanceof Error ? error.message : 'Outlook calendars could not be loaded.' }
  }
  return <div className="stack"><div><Link href="/calendar">Maintenance calendar</Link><h1>Outlook calendar sync</h1><p className="muted">Simeonware remains the source of truth and automatically publishes its schedule to one Outlook calendar.</p></div>
    {query.mailbox === 'connected' ? <div className="notice success">Outlook connected. Choose the calendar to synchronize.</div> : null}{query.mailbox === 'failed' ? <div className="notice error">Outlook could not be connected. Try again and approve calendar access.</div> : null}{query.saved ? <div className="notice success">Outlook calendar selected and synchronized.</div> : null}{query.synced ? <div className="notice success">Outlook calendar is up to date.</div> : null}{query.stopped ? <div className="notice success">Automatic synchronization stopped. Existing Outlook events were left in place.</div> : null}{query.error ? <div className="notice error">{query.error}</div> : null}{calendarLoadError ? <div className="notice error">{calendarLoadError}</div> : null}
    <section className="card stack"><div className="row"><div><div className="kicker">Microsoft account</div><h2>{connection?.status === 'connected' ? connection.email : 'Not connected'}</h2></div><a className="button primary" href="/api/calendar/outlook/connect">{connection?.status === 'connected' ? 'Reconnect Outlook' : 'Connect Outlook'}</a></div>{connection?.status === 'connected' && !hasScope ? <div className="notice">Reconnect Outlook once to approve calendar access. Your existing mailbox connection does not include the new calendar permission.</div> : null}</section>
    {connection && hasScope ? <section className="card stack"><div><div className="kicker">Destination</div><h2>Choose an Outlook calendar</h2></div><form action={saveOutlookCalendarSettingsAction} className="stack"><label>Outlook calendar<select name="calendarId" required defaultValue={connection.outlookCalendarId ?? ''}><option value="" disabled>Choose a calendar</option>{calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}{calendar.isDefaultCalendar ? ' (default)' : ''}</option>)}</select></label><button className="button primary" type="submit" disabled={!calendars.length}>Save and synchronize</button></form></section> : null}
    {connection?.outlookCalendarSyncEnabled ? <section className="card stack"><div className="row"><div><div className="kicker">Sync status</div><h2>{connection.outlookCalendarName ?? 'Outlook calendar'}</h2></div><span className="badge">Automatic</span></div><div className="grid cols-3"><div><strong>{connection._count.outlookCalendarEvents}</strong><div className="muted">Linked events</div></div><div><strong>{connection.calendarLastSyncedAt ? formatDateTime(connection.calendarLastSyncedAt) : 'Not yet'}</strong><div className="muted">Last successful sync</div></div><div><strong>{connection.calendarSyncError ? 'Needs attention' : 'Healthy'}</strong><div className="muted">Connection status</div></div></div>{connection.calendarSyncError ? <div className="notice error">{connection.calendarSyncError}</div> : null}<div className="row"><form action={syncOutlookCalendarAction}><button className="button primary" type="submit">Sync now</button></form><form action={stopOutlookCalendarSyncAction}><button className="button" type="submit">Stop automatic sync</button></form></div></section> : null}
    <section className="card stack"><h2>What is synchronized</h2><div className="grid cols-2"><div><strong>Timed appointments</strong><div className="muted">Vendor appointment start and end times, shown as busy with a reminder.</div></div><div><strong>Deadlines and targets</strong><div className="muted">Inspection due dates, unit-turn targets, and turn tasks, shown as all-day events.</div></div></div><p className="muted">Changes made in Outlook do not overwrite Simeonware. Update the original record here and the next synchronization will update Outlook.</p></section>
  </div>
}
