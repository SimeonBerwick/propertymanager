'use client'

import { useEffect, useState } from 'react'

type ControlState = 'checking' | 'unsupported' | 'blocked' | 'off' | 'on' | 'working' | 'error'

type NativePushPlugin = {
  checkPermissions(): Promise<{ receive: string }>
  requestPermissions(): Promise<{ receive: string }>
  register(): Promise<void>
  addListener(eventName: string, listener: (event: Record<string, unknown>) => void): Promise<{ remove(): Promise<void> }>
}

function getNativePushPlugin() {
  const capacitor = (window as typeof window & {
    Capacitor?: {
      isNativePlatform?: () => boolean
      getPlatform?: () => string
      Plugins?: { PushNotifications?: NativePushPlugin }
    }
  }).Capacitor

  if (!capacitor?.isNativePlatform?.() || capacitor.getPlatform?.() !== 'android') return null
  return capacitor.Plugins?.PushNotifications ?? null
}

async function saveNativeToken(token: string) {
  const response = await fetch('/api/push/native-tokens', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, platform: 'android' }),
  })
  if (!response.ok) throw new Error('Could not save native push token.')
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)))
}

export function PushNotificationControl() {
  const [state, setState] = useState<ControlState>('checking')

  useEffect(() => {
    const nativePush = getNativePushPlugin()
    if (nativePush) {
      let active = true
      const listenerHandles: Array<{ remove(): Promise<void> }> = []

      Promise.all([
        nativePush.addListener('registration', (event) => {
          const token = event.value
          if (typeof token !== 'string') return
          saveNativeToken(token)
            .then(() => { if (active) setState('on') })
            .catch(() => { if (active) setState('error') })
        }),
        nativePush.addListener('registrationError', () => {
          if (active) setState('error')
        }),
        nativePush.addListener('pushNotificationActionPerformed', (event) => {
          const notification = event.notification
          if (!notification || typeof notification !== 'object' || !('data' in notification)) return
          const data = notification.data
          if (!data || typeof data !== 'object' || !('url' in data) || typeof data.url !== 'string') return
          window.location.assign(data.url)
        }),
      ]).then((handles) => {
        listenerHandles.push(...handles)
        return nativePush.checkPermissions()
      }).then(({ receive }) => {
        if (!active) return
        if (receive === 'denied') {
          setState('blocked')
          return
        }
        if (receive === 'granted') {
          setState('working')
          return nativePush.register()
        }
        setState('off')
      }).catch(() => {
        if (active) setState('error')
      })

      return () => {
        active = false
        void Promise.all(listenerHandles.map((handle) => handle.remove()))
      }
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported')
      return
    }

    navigator.serviceWorker.register('/sw.js')
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setState(subscription ? 'on' : Notification.permission === 'denied' ? 'blocked' : 'off'))
      .catch(() => setState('error'))
  }, [])

  async function enable() {
    setState('working')
    try {
      const nativePush = getNativePushPlugin()
      if (nativePush) {
        const { receive } = await nativePush.requestPermissions()
        if (receive !== 'granted') {
          setState(receive === 'denied' ? 'blocked' : 'off')
          return
        }
        await nativePush.register()
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const keyResponse = await fetch('/api/push/public-key')
      if (!keyResponse.ok) throw new Error('Push notifications are not configured.')
      const { publicKey } = await keyResponse.json() as { publicKey: string }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      const response = await fetch('/api/push/subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(subscription),
      })
      if (!response.ok) throw new Error('Could not save push subscription.')
      setState('on')
    } catch {
      setState('error')
    }
  }

  if (state === 'checking' || state === 'unsupported') return null
  if (state === 'on') return <span className="muted" title="Push notifications are enabled">Notifications on</span>
  if (state === 'blocked') return <span className="muted" title="Allow notifications in browser settings">Notifications blocked</span>

  return (
    <button type="button" className="button" onClick={enable} disabled={state === 'working'}>
      {state === 'working' ? 'Enabling...' : state === 'error' ? 'Retry notifications' : 'Enable notifications'}
    </button>
  )
}
