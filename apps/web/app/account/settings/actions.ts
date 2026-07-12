'use server'

import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { isCurrencyOption } from '@/lib/types'
import { writeAuditLog } from '@/lib/audit-log'

export async function updateDefaultCurrencyAction(formData: FormData) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')

  const defaultCurrency = String(formData.get('defaultCurrency') ?? '').trim()
  if (!isCurrencyOption(defaultCurrency)) redirect('/account/settings?currency=invalid' as Route)

  await prisma.user.update({
    where: { id: session.userId },
    data: { defaultCurrency },
    select: { id: true },
  })

  await writeAuditLog({
    orgId: session.userId,
    actorUserId: session.userId,
    entityType: 'user',
    entityId: session.userId,
    action: 'account.defaultCurrencyUpdated',
    summary: `Updated default billing currency to ${defaultCurrency.toUpperCase()}.`,
    metadata: { defaultCurrency },
  })

  redirect('/account/settings?currency=updated' as Route)
}

export async function updateDailyBriefingAction(formData: FormData) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  await prisma.user.update({ where: { id: session.userId }, data: { dailyBriefingEnabled: formData.get('dailyBriefingEnabled') === 'on' } })
  redirect('/account/settings?briefing=updated' as Route)
}

export async function updateVendorRemindersAction(formData: FormData) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  await prisma.user.update({
    where: { id: session.userId },
    data: { vendorRemindersEnabled: formData.get('vendorRemindersEnabled') === 'on' },
  })
  redirect('/account/settings?vendorReminders=updated' as Route)
}
