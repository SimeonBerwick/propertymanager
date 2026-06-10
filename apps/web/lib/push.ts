import webPush from 'web-push'
import { prisma } from '@/lib/prisma'
import type { NotificationMessage } from '@/lib/notify'
import { sendNativePushNotification } from '@/lib/firebase-push'

function getPushConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

export function getVapidPublicKey() {
  return getPushConfig()?.publicKey ?? null
}

function destinationUrl(principalType: string, requestId?: string) {
  if (!requestId) return principalType === 'tenant' ? '/mobile' : principalType === 'vendor' ? '/vendor' : '/dashboard'
  if (principalType === 'tenant') return `/mobile/requests/${requestId}`
  if (principalType === 'vendor') return `/vendor/requests/${requestId}`
  return `/requests/${requestId}`
}

export async function sendPushNotification(message: NotificationMessage) {
  const config = getPushConfig()

  const [users, tenants, vendors] = await Promise.all([
    prisma.user.findMany({ where: { email: { equals: message.to, mode: 'insensitive' } }, select: { id: true } }),
    prisma.tenantIdentity.findMany({ where: { email: { equals: message.to, mode: 'insensitive' } }, select: { id: true } }),
    prisma.vendor.findMany({ where: { email: { equals: message.to, mode: 'insensitive' } }, select: { id: true } }),
  ])
  const principals = [
    ...users.map(({ id }) => ({ principalType: 'user', principalId: id })),
    ...tenants.map(({ id }) => ({ principalType: 'tenant', principalId: id })),
    ...vendors.map(({ id }) => ({ principalType: 'vendor', principalId: id })),
  ]
  if (!principals.length) return

  const subscriptions = await prisma.pushSubscription.findMany({ where: { OR: principals } })
  await sendNativePushNotification(message, principals)
  if (!subscriptions.length || !config) return

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify({
        title: message.subject.replace(/\s+\[PMR:[^\]]+\]$/, ''),
        body: message.text.split(/\r?\n/).find((line) => line.trim())?.trim(),
        url: destinationUrl(subscription.principalType, message.requestId),
      }))
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error ? error.statusCode : undefined
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { endpoint: subscription.endpoint } }).catch(() => undefined)
        return
      }
      console.error('[PUSH] Notification was not delivered:', error)
    }
  }))
}
