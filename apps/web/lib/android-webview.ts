export const ANDROID_SUBSCRIPTION_MESSAGE = 'Check or manage your subscription online at simeonware.com in a web browser.'

export function isAndroidWebView(userAgent: string | null | undefined) {
  return Boolean(userAgent && (/SimeonwareAndroidApp\/\d+(?:\.\d+)*/i.test(userAgent) || /(?:;|\s)wv(?:\)|\s|;)/i.test(userAgent)))
}
