# Multilingual localization

Simeonware Growth and Pro support English, Spanish, French, Canadian French, Portuguese, Polish, Greek, simplified Chinese, Arabic, Punjabi, Vietnamese, Filipino, Urdu, and Romanian. Starter is English-only. Public landing and sign-in pages remain multilingual.

## Production setup

1. In Google Cloud, enable **Cloud Translation API** for the production project.
2. Create an API key and restrict it to **Cloud Translation API**. Do not expose it as a `NEXT_PUBLIC_` variable.
3. Add `GOOGLE_TRANSLATE_API_KEY` to the Vercel Production, Preview, and Development environments.
4. Redeploy, then confirm the localization check is green on `/ops`.
5. Open `/es`, change languages in each of the four portals, and verify a cross-language tenant message before launch.

The standard provider currently includes a monthly credit covering the first 500,000 characters, then charges by translated character. Simeonware caches interface phrases, request text, messages, and notification translations in PostgreSQL to avoid repeat charges.

## Data behavior

- Account language takes priority after sign-in.
- Starter accounts are enforced as English-only on the server. Saved non-English preferences resume after an upgrade to Growth or Pro.
- A public language choice is remembered for one year and is adopted at first sign-in when an account has no explicit preference.
- Arabic and Urdu use right-to-left document direction.
- User messages retain the original and store translated copies with provider/version audit fields.
- Names, addresses, dates, contact details, product names, and money values are protected from translation.
- If translation is unavailable, Simeonware displays or sends the exact original instead of inventing a translation.
- Stripe checkout remains localized by Stripe.
