export const CAMPAIGN_COOKIE_NAME = 'sw_campaign_source'

const AUGUST_SOURCES = [
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
  'youtube',
  'email',
  'direct-outreach',
  'direct',
] as const

export type AugustCampaignSource = typeof AUGUST_SOURCES[number]

export function parseAugustCampaignSource(value: unknown): AugustCampaignSource | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return AUGUST_SOURCES.includes(normalized as AugustCampaignSource)
    ? normalized as AugustCampaignSource
    : null
}

export function augustTrialSource(value: unknown) {
  const source = parseAugustCampaignSource(value)
  return source ? `august_${source}` : 'public_signup'
}

export function augustCampaignMedium(source: AugustCampaignSource) {
  if (source === 'email' || source === 'direct-outreach') return 'outreach'
  if (source === 'direct') return 'direct'
  return 'social'
}
