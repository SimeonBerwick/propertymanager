import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { prisma } from '@/lib/prisma'
import type { NotificationMessage } from '@/lib/notify'

type PushPrincipal = {
  principalType: string
  principalId: string
}

function getFirebaseMessaging() {
  try {
    if (!getApps().length) {
      const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
      const hasApplicationCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim())
      if (!credentials && !hasApplicationCredentials) return null

      initializeApp({
        credential: credentials ? cert(JSON.parse(credentials)) : applicationDefault(),
      })
    }

    return getMessaging()
  } catch (error) {
    console.error('[FCM] Firebase credentials are invalid:', error)
    return null
  }
}

function isInvalidTokenError(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  return error.code === 'messaging/registration-token-not-registered'
    || error.code === 'messaging/invalid-registration-token'
}

export async function sendNativePushNotification(
  message: NotificationMessage,
  principals: PushPrincipal[],
) {
  const messaging = getFirebaseMessaging()
  if (!messaging || !principals.length) return

  const tokens = await prisma.nativePushToken.findMany({ where: { OR: principals } })
  await Promise.all(tokens.map(async ({ token, principalType }) => {
    try {
      await messaging.send({
        token,
        notification: {
          title: message.subject.replace(/\s+\[PMR:[^\]]+\]$/, ''),
          body: message.text.split(/\r?\n/).find((line) => line.trim())?.trim(),
        },
        data: { url: message.actionUrl ?? destinationUrl(principalType, message.requestId) },
        android: { priority: 'high' },
      })
    } catch (error) {
      if (isInvalidTokenError(error)) {
        await prisma.nativePushToken.delete({ where: { token } }).catch(() => undefined)
        return
      }
      console.error('[FCM] Notification was not delivered:', error)
    }
  }))
}

function destinationUrl(principalType: string, requestId?: string) {
  if (!requestId) return principalType === 'tenant' ? '/mobile' : principalType === 'vendor' ? '/vendor' : '/dashboard'
  if (principalType === 'tenant') return `/mobile/requests/${requestId}`
  if (principalType === 'vendor') return `/vendor/requests/${requestId}`
  return `/requests/${requestId}`
}
