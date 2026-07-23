import { currencyLabel, type CurrencyOption } from '@/lib/types'

export interface BillingPdfInput {
  title: string
  recipientLabel: string
  documentType: string
  status: string
  amountCents: number
  paidCents: number
  currency: CurrencyOption
  description?: string
  requestTitle: string
  propertyName: string
  unitLabel: string
}

function money(amountCents: number, currency: BillingPdfInput['currency']) {
  return `${currencyLabel(currency)} ${((amountCents || 0) / 100).toFixed(2)}`
}

export function escapeBillingHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === '&') return '&amp;'
    if (character === '<') return '&lt;'
    if (character === '>') return '&gt;'
    if (character === '"') return '&quot;'
    return '&#39;'
  })
}

export function renderBillingPdfHtml(input: BillingPdfInput) {
  const balance = Math.max(0, input.amountCents - input.paidCents)
  const title = escapeBillingHtml(input.title)
  const recipientLabel = escapeBillingHtml(input.recipientLabel)
  const documentType = escapeBillingHtml(input.documentType)
  const status = escapeBillingHtml(input.status)
  const requestTitle = escapeBillingHtml(input.requestTitle)
  const propertyName = escapeBillingHtml(input.propertyName)
  const unitLabel = escapeBillingHtml(input.unitLabel)
  const description = escapeBillingHtml(input.description || 'No additional notes.')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="font-family: Inter, Arial, sans-serif; padding: 32px; color: #111827;">
  <div style="max-width: 760px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden;">
    <div style="padding: 24px; background: #0f172a; color: white;">
      <div style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.8;">Simeonware LLC</div>
      <h1 style="margin: 8px 0 0; font-size: 28px;">${title}</h1>
    </div>
    <div style="padding: 24px;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr><td style="padding: 8px 0; color: #6b7280;">Recipient</td><td style="padding: 8px 0;">${recipientLabel}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Document type</td><td style="padding: 8px 0;">${documentType}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Status</td><td style="padding: 8px 0;">${status}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Request</td><td style="padding: 8px 0;">${requestTitle}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Property</td><td style="padding: 8px 0;">${propertyName} - ${unitLabel}</td></tr>
      </table>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
        <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px;">
          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em;">Total</div>
          <div style="font-size: 24px; font-weight: 700; margin-top: 8px;">${money(input.amountCents, input.currency)}</div>
        </div>
        <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px;">
          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em;">Paid</div>
          <div style="font-size: 24px; font-weight: 700; margin-top: 8px;">${money(input.paidCents, input.currency)}</div>
        </div>
        <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px;">
          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em;">Balance</div>
          <div style="font-size: 24px; font-weight: 700; margin-top: 8px;">${money(balance, input.currency)}</div>
        </div>
      </div>

      <div>
        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">Description</div>
        <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; background: #f8fafc; white-space: pre-wrap;">${description}</div>
      </div>
    </div>
  </div>
</body>
</html>`
}
