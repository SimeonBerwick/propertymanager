import { describe, expect, test } from 'vitest'
import { escapeBillingHtml, renderBillingPdfHtml } from '@/lib/billing-pdf'

describe('billing document HTML security', () => {
  test('escapes HTML metacharacters', () => {
    expect(escapeBillingHtml(`<script data-value="x">'&</script>`)).toBe(
      '&lt;script data-value=&quot;x&quot;&gt;&#39;&amp;&lt;/script&gt;',
    )
  })

  test('does not render executable customer-supplied markup', () => {
    const attack = `</td><script>fetch('/account')</script><img src=x onerror=alert(1)>`
    const html = renderBillingPdfHtml({
      title: attack,
      recipientLabel: attack,
      documentType: 'tenant_invoice',
      status: 'draft',
      amountCents: 100,
      paidCents: 0,
      currency: 'usd',
      description: attack,
      requestTitle: attack,
      propertyName: attack,
      unitLabel: attack,
    })

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })
})
