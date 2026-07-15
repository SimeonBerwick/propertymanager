'use client'

import { useEffect } from 'react'
import { trackProductEvent } from '@/components/analytics-tracker'
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
  return (
    <a
      className={className}
      href={href}
      onClick={() => trackProductEvent(eventName, { campaign: 'august_founders', source })}
    >
      {children}
    </a>
  )
}
