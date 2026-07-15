import { describe, expect, it } from 'vitest'
import { augustTrialSource, parseAugustCampaignSource } from './campaign-attribution'

describe('August campaign attribution', () => {
  it('accepts only known launch sources', () => {
    expect(parseAugustCampaignSource('Instagram')).toBe('instagram')
    expect(parseAugustCampaignSource('unknown-network')).toBeNull()
  })

  it('creates a stable trial source without accepting arbitrary input', () => {
    expect(augustTrialSource('facebook')).toBe('august_facebook')
    expect(augustTrialSource('<script>')).toBe('public_signup')
  })
})
