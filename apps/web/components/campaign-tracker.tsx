'use client'

import { useEffect } from 'react'
import { trackProductEvent } from '@/components/analytics-tracker'
import { SectionJumpLink } from '@/components/section-jump-link'
import type { AugustCampaignSource } from '@/lib/campaign-attribution'

export function CampaignTracker({ source }: { source: AugustCampaignSource }) {
  useEffect(() => {
    trackProductEvent('campaign_page_view', { campaign: 'august_founders', source })
  }, [source])

  return null
}

export function CampaignLink({
  eventName,
  source,
  className,
  href,
  children,
}: {
  eventName: 'campaign_consultation_click' | 'campaign_trial_click'
  source: AugustCampaignSource
  className?: string
  href: string
  children: React.ReactNode
}) {
  const trackClick = () => trackProductEvent(eventName, { campaign: 'august_founders', source })

  if (href.startsWith('#')) {
    return (
      <SectionJumpLink
        className={className}
        href={href as `#${string}`}
        onActivate={trackClick}
      >
        {children}
      </SectionJumpLink>
    )
  }

  return (
    <a
      className={className}
      href={href}
      onClick={trackClick}
    >
      {children}
    </a>
  )
}
