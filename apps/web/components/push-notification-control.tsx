'use client'

import { useEffect, useState } from 'react'

type ControlState = 'checking' | 'unsupported' | 'blocked' | 'off' | 'on' | 'working' | 'error'

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)))
}

export function PushNotificationControl() {
  const [state, setState] = useState<ControlState>('checking')

  useEffect(() => {
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
