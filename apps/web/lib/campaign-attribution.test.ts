import { describe, expect, it } from 'vitest'
import { augustCampaignMedium, augustTrialSource, parseAugustCampaignSource } from './campaign-attribution'

describe('August campaign attribution', () => {
  it('accepts only known launch sources', () => {
    expect(parseAugustCampaignSource('Instagram')).toBe('instagram')
    expect(parseAugustCampaignSource('YouTube')).toBe('youtube')
    expect(parseAugustCampaignSource('direct-outreach')).toBe('direct-outreach')
    expect(parseAugustCampaignSource('unknown-network')).toBeNull()
  })

  it('creates a stable trial source without accepting arbitrary input', () => {
    expect(augustTrialSource('facebook')).toBe('august_facebook')
    expect(augustTrialSource('<script>')).toBe('public_signup')
  })

  it('keeps social, outreach, and direct traffic distinct', () => {
    expect(augustCampaignMedium('linkedin')).toBe('social')
    expect(augustCampaignMedium('direct-outreach')).toBe('outreach')
    expect(augustCampaignMedium('direct')).toBe('direct')
  })
})
