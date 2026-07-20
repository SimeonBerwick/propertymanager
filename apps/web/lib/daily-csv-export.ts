import { buildChangedCsvExports } from '@/lib/csv-export'
import { sendNotification } from '@/lib/notify'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit-log'
import { getAppBaseUrl } from '@/lib/runtime-env'

const DAY_MS = 24 * 60 * 60 * 1000

export async function sendDailyCsvExportToLandlord(userId: string, now = new Date(), options: { force?: boolean } = {}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      dailyCsvExportEnabled: true,
      dailyCsvExportLastSentAt: true,
    },
  })
  if (!user?.dailyCsvExportEnabled || !user.email) {
    return { ok: false, skipped: true, reason: 'disabled' }
  }
  if (!options.force && user.dailyCsvExportLastSentAt && now.getTime() - user.dailyCsvExportLastSentAt.getTime() < DAY_MS) {
    return { ok: true, skipped: true, reason: 'not-due' }
  }

  const since = user.dailyCsvExportLastSentAt ?? new Date(now.getTime() - DAY_MS)
  const exports = await buildChangedCsvExports(user.id, since)
  const changed = exports.filter((file) => file.rowCount > 0)
  if (!changed.length) {
    await prisma.user.update({
      where: { id: user.id },
      data: { dailyCsvExportLastSentAt: now },
    })
    return { ok: true, skipped: true, reason: 'no-changes' }
  }

  const result = await sendNotification({
    to: user.email,
    subject: '[Simeonware] Daily CSV changes',
    text: [
      `Attached are records changed since ${since.toISOString()}.`,
      '',
      ...changed.map((file) => `- ${file.kind}: ${file.rowCount} changed record${file.rowCount === 1 ? '' : 's'}`),
      '',
      'You can also download current CSV exports while signed in:',
      `- Units: ${getAppBaseUrl('daily CSV export links')}/api/ops/csv/units`,
      `- Vendors: ${getAppBaseUrl('daily CSV export links')}/api/ops/csv/vendors`,
      `- Tickets: ${getAppBaseUrl('daily CSV export links')}/api/ops/csv/tickets`,
    ].join('\n'),
    attachments: changed.map((file) => ({
      filename: file.filename,
      content: file.content,
      contentType: 'text/csv; charset=utf-8',
    })),
  }, { ownerUserId: user.id, transportHint: 'system', bypassUserPreference: true })

  if (!result.ok) return { ok: false, skipped: false, reason: 'delivery-failed' }

  await prisma.user.update({
    where: { id: user.id },
    data: { dailyCsvExportLastSentAt: now },
  })
  await writeAuditLog({
    orgId: user.id,
    actorUserId: user.id,
    entityType: 'user',
    entityId: user.id,
    action: 'csv.dailyExportSent',
    summary: `Daily CSV changes emailed: ${changed.map((file) => `${file.rowCount} ${file.kind}`).join(', ')}.`,
  })
  return { ok: true, skipped: false, files: changed.length }
}

export async function sendDueDailyCsvExports(now = new Date()) {
  const users = await prisma.user.findMany({
    where: { role: 'landlord', dailyCsvExportEnabled: true, workspaceResetPendingAt: null },
    select: { id: true },
  })
  const results = []
  for (const user of users) {
    results.push({ userId: user.id, ...(await sendDailyCsvExportToLandlord(user.id, now)) })
  }
  return results
}
