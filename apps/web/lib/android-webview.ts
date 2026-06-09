export function isAndroidWebView(userAgent: string | null | undefined) {
  if (!userAgent || !/Android/i.test(userAgent)) return false
  return /\bwv\b/i.test(userAgent) || /Version\/4\.0/i.test(userAgent)
}
