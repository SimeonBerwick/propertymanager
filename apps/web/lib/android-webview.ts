export const ANDROID_SUBSCRIPTION_MESSAGE = 'Check or manage your subscription online at simeonware.com in a web browser.'

export function isAndroidWebView(userAgent: string | null | undefined) {
  if (!userAgent || !/Android/i.test(userAgent)) return false
  return /SimeonwareAndroidApp/i.test(userAgent) || /\bwv\b/i.test(userAgent) || /Version\/4\.0/i.test(userAgent)
}
