# August founding-manager campaign

## Public links

- Facebook: `https://www.simeonware.com/august?utm_source=facebook&utm_medium=social&utm_campaign=august_founders`
- Instagram: `https://www.simeonware.com/august?utm_source=instagram&utm_medium=social&utm_campaign=august_founders`
- TikTok: `https://www.simeonware.com/august?utm_source=tiktok&utm_medium=social&utm_campaign=august_founders`
- LinkedIn: `https://www.simeonware.com/august?utm_source=linkedin&utm_medium=social&utm_campaign=august_founders`
- YouTube: `https://www.simeonware.com/august?utm_source=youtube&utm_medium=social&utm_campaign=august_founders`
- Direct email: `https://www.simeonware.com/august?utm_source=email&utm_medium=outreach&utm_campaign=august_founders`
- Direct outreach: `https://www.simeonware.com/august?utm_source=direct-outreach&utm_medium=outreach&utm_campaign=august_founders`

Use campaign code `AUGUSTFOUNDERS` in personal outreach and consultation notes.

## Channel priority

- 50% LinkedIn: credibility, conversations, demonstrations, and partnerships.
- 35% direct email: cooperative apartments and selected property managers.
- 15% Instagram and TikTok: short demonstrations that support LinkedIn outreach.

Treat social video as sales proof, not the primary lead engine. LinkedIn and direct email own discovery conversations, demonstrations, and assisted-trial follow-up.

## Funnel definitions

| Stage | Evidence |
| --- | --- |
| Lead source | `campaign_page_view`, stored with the allowlisted source |
| Opened conversation form | `campaign_consultation_click` |
| Submitted conversation request | `campaign_consultation_submitted` |
| Trial intent | `campaign_trial_click` |
| Trial | `trial_started`, linked to the new organization and campaign source |
| Activation | Units imported, at least one tenant or vendor connected, and five real requests processed within 14 days |
| Conversion | `subscription_started` after a verified Stripe checkout webhook |

Track every company through `Identified`, `Contacted`, `Replied`, `Discovery`, `Demonstration`, `Trial`, `Activated`, `Paid`, or `Lost`. Outreach and consultation outcomes should be kept in the founder CRM or campaign sheet using the same source and campaign code. Do not record a subscription as paid until Stripe confirms checkout.
