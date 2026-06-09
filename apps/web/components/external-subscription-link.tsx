import { PUBLIC_SUBSCRIPTION_URL } from '@/lib/android-webview'

export function ExternalSubscriptionLink() {
  return (
    <a
      className="button primary"
      href={PUBLIC_SUBSCRIPTION_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      Open subscription website
    </a>
  )
}
