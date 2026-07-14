import { createAssistedTrialInvite } from '../lib/assisted-trial-invite'

const email = process.argv[2]?.trim()
const validDays = process.argv[3] ? Number(process.argv[3]) : undefined
if (!email) {
  console.error('Usage: npm run trial:invite -- manager@example.com [valid-days]')
  process.exit(1)
}

const token = createAssistedTrialInvite(email, { validDays })
const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_BASE_URL ?? 'https://simeonware.com').replace(/\/$/, '')
console.log(`${baseUrl}/signup?invite=${encodeURIComponent(token)}`)
