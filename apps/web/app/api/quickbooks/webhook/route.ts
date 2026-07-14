import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { reconcileQuickBooksConnection, verifyQuickBooksWebhookSignature } from '@/lib/quickbooks'

type WebhookPayload = { eventNotifications?: Array<{ realmId?: string }> }

export async function POST(request: NextRequest) {
  const payload = await request.text()
  if (!verifyQuickBooksWebhookSignature(payload, request.headers.get('intuit-signature'))) {
    return NextResponse.json({ error: 'Invalid QuickBooks webhook signature.' }, { status: 401 })
  }

  const body = JSON.parse(payload || '{}') as WebhookPayload
  const realmIds = [...new Set((body.eventNotifications ?? []).map((event) => event.realmId?.trim()).filter((value): value is string => Boolean(value)))]
  for (const realmId of realmIds) {
    const connections = await prisma.quickBooksConnection.findMany({ where: { realmId, status: 'connected' }, select: { id: true, userId: true } })
    for (const connection of connections) {
      await prisma.quickBooksConnection.update({ where: { id: connection.id }, data: { lastWebhookAt: new Date() } })
      await reconcileQuickBooksConnection(connection.userId, { force: true }).catch(() => null)
    }
  }
  return NextResponse.json({ ok: true })
}
