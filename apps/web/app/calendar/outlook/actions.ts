'use server'

import type { Route } from 'next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { clearOutlookCalendarMappings, hasOutlookCalendarScope, listOutlookCalendars, syncOutlookCalendarForUser } from '@/lib/outlook-calendar-sync'

function fail(message: string): never { redirect(`/calendar/outlook?error=${encodeURIComponent(message)}` as Route) }
async function manager() { const session = await getLandlordSession(); if (!session) redirect('/login?error=session-expired'); return session }

export async function saveOutlookCalendarSettingsAction(formData: FormData) {
  const session = await manager()
  const calendarId = String(formData.get('calendarId') ?? '').trim()
  const connection = await prisma.mailboxConnection.findFirst({ where: { userId: session.userId, provider: 'outlook', status: 'connected' } })
  if (!connection || !hasOutlookCalendarScope(connection.scopesCsv)) fail('Reconnect Outlook and approve calendar access first.')
  let calendars
  try { calendars = await listOutlookCalendars(connection.id) } catch (error) { fail(error instanceof Error ? error.message : 'Outlook calendars could not be loaded.') }
  const calendar = calendars.find((item) => item.id === calendarId)
  if (!calendar) fail('Choose a calendar you can edit.')
  try {
    if (connection.outlookCalendarId && connection.outlookCalendarId !== calendar.id) await clearOutlookCalendarMappings(session.userId)
    await prisma.mailboxConnection.update({ where: { id: connection.id }, data: { outlookCalendarSyncEnabled: true, outlookCalendarId: calendar.id, outlookCalendarName: calendar.name, calendarSyncError: null } })
    await syncOutlookCalendarForUser(session.userId)
  } catch (error) { fail(error instanceof Error ? error.message : 'Outlook calendar synchronization failed.') }
  revalidatePath('/calendar/outlook'); revalidatePath('/calendar')
  redirect('/calendar/outlook?saved=1')
}

export async function syncOutlookCalendarAction() {
  const session = await manager()
  try { await syncOutlookCalendarForUser(session.userId) } catch (error) { fail(error instanceof Error ? error.message : 'Outlook calendar synchronization failed.') }
  revalidatePath('/calendar/outlook')
  redirect('/calendar/outlook?synced=1')
}

export async function stopOutlookCalendarSyncAction() {
  const session = await manager()
  await prisma.mailboxConnection.updateMany({ where: { userId: session.userId, provider: 'outlook' }, data: { outlookCalendarSyncEnabled: false, calendarSyncError: null } })
  revalidatePath('/calendar/outlook')
  redirect('/calendar/outlook?stopped=1')
}
