import { describe, expect, test } from 'vitest'
import { isAndroidWebView } from '@/lib/android-webview'

describe('isAndroidWebView', () => {
  test('detects Android WebView requests', () => {
    expect(isAndroidWebView('Mozilla/5.0 (Linux; Android 15; Pixel 8 Build/AP3A; wv) AppleWebKit/537.36 Version/4.0 Chrome/131 Mobile Safari/537.36')).toBe(true)
  })

  test('detects the explicit Android app user-agent marker', () => {
    expect(isAndroidWebView('Mozilla/5.0 (Linux; Android 15) Chrome/131 Mobile SimeonwareAndroidApp/1.0')).toBe(true)
  })

  test('does not treat a normal Android browser as the installed app', () => {
    expect(isAndroidWebView('Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36')).toBe(false)
  })

  test('does not classify desktop browsers as Android app views', () => {
    expect(isAndroidWebView('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36')).toBe(false)
  })
})
