'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    Capacitor?: {
      getPlatform?: () => string
      isNativePlatform?: () => boolean
    }
  }
}

function isRunningInAndroidApp() {
  const capacitor = window.Capacitor
  const platform = capacitor?.getPlatform?.()
  const isNative = capacitor?.isNativePlatform?.() === true || (platform !== undefined && platform !== 'web')
  const isMarkedAndroid = /Android/i.test(navigator.userAgent) && /SimeonwareAndroidApp/i.test(navigator.userAgent)

  return isNative || isMarkedAndroid
}

export function AndroidRuntimeMarker() {
  useEffect(() => {
    const markIfApp = () => {
      if (isRunningInAndroidApp()) {
        document.documentElement.classList.add('simeonware-android-app')
      }
    }

    markIfApp()
    const retry = window.setTimeout(markIfApp, 250)

    return () => window.clearTimeout(retry)
  }, [])

  return null
}
