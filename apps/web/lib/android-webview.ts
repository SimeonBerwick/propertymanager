export const PUBLIC_SUBSCRIPTION_URL = 'https://www.simeonware.com/account/subscription?external=1'

export function isAndroidWebView(userAgent: string | null | undefined) {
  if (!userAgent || !/Android/i.test(userAgent)) return false
  return /\bwv\b/i.test(userAgent) || /Version\/4\.0/i.test(userAgent)
}
