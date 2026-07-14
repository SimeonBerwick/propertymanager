import { after, NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { quickBooksWebhookRealmIds, reconcileQuickBooksConnection, verifyQuickBooksWebhookSignature } from '@/lib/quickbooks'

export async function POST(request: NextRequest) {
  const payload = await request.text()
  if (!verifyQuickBooksWebhookSignature(payload, request.headers.get('intuit-signature'))) {
    return NextResponse.json({ error: 'Invalid QuickBooks webhook signature.' }, { status: 401 })
  }

  const realmIds = quickBooksWebhookRealmIds(JSON.parse(payload || '{}'))
  const userIds: string[] = []
  for (const realmId of realmIds) {
    const connections = await prisma.quickBooksConnection.findMany({ where: { realmId, status: 'connected' }, select: { id: true, userId: true } })
    for (const connection of connections) {
      await prisma.quickBooksConnection.update({ where: { id: connection.id }, data: { lastWebhookAt: new Date() } })
      userIds.push(connection.userId)
    }
  }
  after(async () => {
    for (const userId of [...new Set(userIds)]) await reconcileQuickBooksConnection(userId, { force: true }).catch(() => null)
  })
  return NextResponse.json({ ok: true })
}
