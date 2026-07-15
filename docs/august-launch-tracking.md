# August founding-manager campaign

## Public links

- Facebook: `https://www.simeonware.com/august?utm_source=facebook&utm_medium=social&utm_campaign=august_founders`
- Instagram: `https://www.simeonware.com/august?utm_source=instagram&utm_medium=social&utm_campaign=august_founders`
- TikTok: `https://www.simeonware.com/august?utm_source=tiktok&utm_medium=social&utm_campaign=august_founders`
- LinkedIn: `https://www.simeonware.com/august?utm_source=linkedin&utm_medium=social&utm_campaign=august_founders`
- Direct email: `https://www.simeonware.com/august?utm_source=email&utm_medium=outreach&utm_campaign=august_founders`

Use campaign code `AUGUSTFOUNDERS` in personal outreach and consultation notes.

## Funnel definitions

| Stage | Evidence |
| --- | --- |
| Lead source | `campaign_page_view`, stored with the allowlisted source |
| Opened conversation form | `campaign_consultation_click` |
| Submitted conversation request | `campaign_consultation_submitted` |
| Trial intent | `campaign_trial_click` |
| Trial | `trial_started`, linked to the new organization and campaign source |
| Activation | First `property_created` and first `request_submitted` events |
| Conversion | `subscription_started` after a verified Stripe checkout webhook |

Outreach and consultation outcomes should be kept in the founder CRM or campaign sheet using the same source and campaign code. Do not record a subscription as converted until Stripe confirms checkout.
