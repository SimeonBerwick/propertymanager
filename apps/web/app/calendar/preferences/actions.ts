'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'

const number = (data: FormData, key: string) => Number(String(data.get(key) ?? ''))
export async function saveSchedulingPreferencesAction(formData: FormData) {
  const session = await getLandlordSession(); if (!session) redirect('/login?error=session-expired')
  const start = number(formData, 'workingHourStart'); const end = number(formData, 'workingHourEnd'); const notice = number(formData, 'minimumNoticeHours'); const duration = number(formData, 'defaultDurationMinutes'); const expiry = number(formData, 'proposalExpiryHours')
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 24 || start >= end) redirect('/calendar/preferences?error=Choose%20valid%20working%20hours')
  if (!Number.isInteger(notice) || notice < 0 || notice > 336 || !Number.isInteger(duration) || duration < 15 || duration > 480 || !Number.isInteger(expiry) || expiry < 1 || expiry > 168) redirect('/calendar/preferences?error=Choose%20valid%20notice%2C%20duration%2C%20and%20expiry%20values')
  await prisma.user.update({ where: { id: session.userId }, data: { schedulingCoordinationEnabled: Boolean(formData.get('enabled')), schedulingAutoConfirmEnabled: Boolean(formData.get('autoConfirm')), schedulingWorkingHourStart: start, schedulingWorkingHourEnd: end, schedulingMinimumNoticeHours: notice, schedulingDefaultDurationMinutes: duration, schedulingProposalExpiryHours: expiry } })
  revalidatePath('/calendar/preferences'); redirect('/calendar/preferences?saved=1')
}
