import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { refreshMailboxAccessToken } from '@/lib/mailbox-providers'
import { buildMaintenanceCalendarEvents, calendarDateParam, calendarEventDateKey, type MaintenanceCalendarEvent } from '@/lib/maintenance-calendar'
import { getAppBaseUrl } from '@/lib/runtime-env'

type OutlookCalendar = { id: string; name: string; isDefaultCalendar?: boolean; canEdit?: boolean }
type OutlookPayload = {
  subject: string
  body: { contentType: 'HTML'; content: string }
  start: { dateTime: string; timeZone: 'UTC' }
  end: { dateTime: string; timeZone: 'UTC' }
  isAllDay: boolean
  location: { displayName: string }
  showAs: 'busy' | 'free'
  isReminderOn: boolean
  reminderMinutesBeforeStart?: number
  transactionId: string
  categories: string[]
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export function hasOutlookCalendarScope(scopesCsv: string | null | undefined) {
  return String(scopesCsv ?? '').split(/[\s,]+/).some((scope) => scope.toLowerCase() === 'calendars.readwrite')
}

export function buildOutlookEventPayload(event: MaintenanceCalendarEvent, appBaseUrl: string): OutlookPayload {
  const allDay = event.kind !== 'appointment'
  const day = calendarEventDateKey(event.start)
  const nextDayDate = new Date(`${day}T12:00:00Z`)
  nextDayDate.setUTCDate(nextDayDate.getUTCDate() + 1)
  const start = allDay ? `${day}T00:00:00` : event.start.toISOString().replace(/Z$/, '')
  const endDate = event.end && event.end > event.start ? event.end : new Date(event.start.getTime() + 60 * 60 * 1000)
  const end = allDay ? `${calendarDateParam(nextDayDate)}T00:00:00` : endDate.toISOString().replace(/Z$/, '')
  return {
    subject: `[Simeonware] ${event.title}`,
    body: { contentType: 'HTML', content: `<p><strong>${escapeHtml(event.propertyName)} - ${escapeHtml(event.unitLabel)}</strong></p><p>${escapeHtml(event.title)}</p><p><a href="${escapeHtml(`${appBaseUrl}${event.href}`)}">Open in Simeonware</a></p>` },
    start: { dateTime: start, timeZone: 'UTC' },
    end: { dateTime: end, timeZone: 'UTC' },
    isAllDay: allDay,
    location: { displayName: `${event.propertyName} - ${event.unitLabel}` },
    showAs: allDay ? 'free' : 'busy',
    isReminderOn: !allDay,
    ...(!allDay ? { reminderMinutesBeforeStart: 60 } : {}),
    transactionId: `simeonware:${event.id}`,
    categories: ['Simeonware'],
  }
}

export function outlookPayloadHash(payload: OutlookPayload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

async function graphRequest(accessToken: string, path: string, init?: RequestInit) {
  return fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', ...init?.headers },
  })
}

export async function listOutlookCalendars(connectionId: string): Promise<OutlookCalendar[]> {
  const token = await refreshMailboxAccessToken(connectionId)
  if (!token) throw new Error('Reconnect Outlook to continue.')
  const response = await graphRequest(token, '/me/calendars?$select=id,name,isDefaultCalendar,canEdit')
  const body = await response.json().catch(() => ({})) as { value?: OutlookCalendar[] }
  if (!response.ok) throw new Error('Outlook calendars could not be loaded.')
  return (body.value ?? []).filter((calendar) => calendar.canEdit !== false).sort((a, b) => Number(Boolean(b.isDefaultCalendar)) - Number(Boolean(a.isDefaultCalendar)) || a.name.localeCompare(b.name))
}

async function collectSyncEvents(userId: string, start: Date, end: Date) {
  const [requests, inspections, turns] = await Promise.all([
    prisma.maintenanceRequest.findMany({ where: { property: { ownerId: userId }, vendorScheduledStart: { gte: start, lt: end } }, include: { unit: { include: { property: true } } } }),
    prisma.inspection.findMany({ where: { orgId: userId, dueAt: { gte: start, lt: end } }, include: { unit: { include: { property: true } } } }),
    prisma.unitTurn.findMany({ where: { orgId: userId, OR: [{ targetMoveInAt: { gte: start, lt: end } }, { tasks: { some: { dueAt: { gte: start, lt: end } } } }] }, include: { unit: { include: { property: true } }, tasks: { where: { dueAt: { gte: start, lt: end } }, include: { assignedVendor: true } } } }),
  ])
  return buildMaintenanceCalendarEvents({ requests, inspections, turns })
}

async function createOutlookEvent(token: string, calendarId: string, payload: OutlookPayload) {
  const response = await graphRequest(token, `/me/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body: JSON.stringify(payload) })
  const body = await response.json().catch(() => ({})) as { id?: string }
  if (!response.ok || !body.id) throw new Error('Outlook rejected a calendar event.')
  return body.id
}

export async function syncOutlookCalendarForUser(userId: string, now = new Date()) {
  const connection = await prisma.mailboxConnection.findFirst({ where: { userId, provider: 'outlook', status: 'connected', outlookCalendarSyncEnabled: true } })
  if (!connection?.outlookCalendarId || !hasOutlookCalendarScope(connection.scopesCsv)) return { enabled: false, created: 0, updated: 0, deleted: 0, skipped: 0 }
  const start = new Date(now.getTime() - 30 * 86_400_000)
  const end = new Date(now.getTime() + 365 * 86_400_000)
  try {
    const token = await refreshMailboxAccessToken(connection.id)
    if (!token) throw new Error('Reconnect Outlook to continue syncing.')
    const events = await collectSyncEvents(userId, start, end)
    const allMappings = await prisma.outlookCalendarEvent.findMany({ where: { mailboxConnectionId: connection.id } })
    const mappingsInWindow = allMappings.filter((mapping) => mapping.sourceStartAt >= start && mapping.sourceStartAt < end)
    const mappingBySource = new Map(allMappings.map((mapping) => [`${mapping.sourceType}:${mapping.sourceId}`, mapping]))
    const active = new Set<string>()
    let created = 0; let updated = 0; let skipped = 0; let deleted = 0
    for (const event of events) {
      const sourceType = event.kind
      const sourceId = event.id
      const key = `${sourceType}:${sourceId}`
      active.add(key)
      const payload = buildOutlookEventPayload(event, getAppBaseUrl('Outlook calendar links'))
      const contentHash = outlookPayloadHash(payload)
      const mapping = mappingBySource.get(key)
      if (mapping?.contentHash === contentHash) { skipped += 1; continue }
      let outlookEventId = mapping?.outlookEventId
      if (outlookEventId) {
        const { transactionId: _transactionId, ...updatePayload } = payload
        const response = await graphRequest(token, `/me/calendars/${encodeURIComponent(connection.outlookCalendarId)}/events/${encodeURIComponent(outlookEventId)}`, { method: 'PATCH', body: JSON.stringify(updatePayload) })
        if (response.status === 404) outlookEventId = undefined
        else if (!response.ok) throw new Error('Outlook rejected an event update.')
      }
      if (!outlookEventId) { outlookEventId = await createOutlookEvent(token, connection.outlookCalendarId, payload); created += 1 } else updated += 1
      await prisma.outlookCalendarEvent.upsert({
        where: { mailboxConnectionId_sourceType_sourceId: { mailboxConnectionId: connection.id, sourceType, sourceId } },
        update: { outlookEventId, contentHash, sourceStartAt: event.start, lastSyncedAt: now },
        create: { userId, mailboxConnectionId: connection.id, sourceType, sourceId, outlookEventId, contentHash, sourceStartAt: event.start, lastSyncedAt: now },
      })
    }
    for (const mapping of mappingsInWindow) {
      if (active.has(`${mapping.sourceType}:${mapping.sourceId}`)) continue
      const response = await graphRequest(token, `/me/calendars/${encodeURIComponent(connection.outlookCalendarId)}/events/${encodeURIComponent(mapping.outlookEventId)}`, { method: 'DELETE' })
      if (response.ok || response.status === 404) { await prisma.outlookCalendarEvent.delete({ where: { id: mapping.id } }); deleted += 1 }
      else throw new Error('Outlook rejected removal of an obsolete event.')
    }
    await prisma.mailboxConnection.update({ where: { id: connection.id }, data: { calendarLastSyncedAt: now, calendarSyncError: null } })
    return { enabled: true, created, updated, deleted, skipped }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Outlook calendar sync failed.'
    await prisma.mailboxConnection.update({ where: { id: connection.id }, data: { calendarSyncError: message } }).catch(() => null)
    throw error
  }
}

export async function syncAllOutlookCalendars() {
  const connections = await prisma.mailboxConnection.findMany({ where: { provider: 'outlook', status: 'connected', outlookCalendarSyncEnabled: true }, select: { userId: true } })
  let synced = 0; let failed = 0
  for (const connection of connections) {
    try { await syncOutlookCalendarForUser(connection.userId); synced += 1 } catch { failed += 1 }
  }
  return { processed: connections.length, synced, failed }
}

export async function clearOutlookCalendarMappings(userId: string) {
  const connection = await prisma.mailboxConnection.findFirst({ where: { userId, provider: 'outlook', status: 'connected' } })
  if (!connection?.outlookCalendarId) return { deleted: 0 }
  const token = await refreshMailboxAccessToken(connection.id)
  if (!token) throw new Error('Reconnect Outlook before changing calendars.')
  const mappings = await prisma.outlookCalendarEvent.findMany({ where: { mailboxConnectionId: connection.id } })
  let deleted = 0
  for (const mapping of mappings) {
    const response = await graphRequest(token, `/me/calendars/${encodeURIComponent(connection.outlookCalendarId)}/events/${encodeURIComponent(mapping.outlookEventId)}`, { method: 'DELETE' })
    if (!response.ok && response.status !== 404) throw new Error('Could not remove synchronized events from the previous Outlook calendar.')
    await prisma.outlookCalendarEvent.delete({ where: { id: mapping.id } })
    deleted += 1
  }
  return { deleted }
}
