import Link from 'next/link'
import { formatMoney } from '@/lib/billing-utils'
import { formatDateOnly } from '@/lib/ui-utils'
import type { UnitBillingSummaryRow } from '@/lib/unit-billing-summary'

function Totals({ totals }: { totals: Record<string, number> }) {
  const entries = Object.entries(totals).filter(([, cents]) => cents !== 0)
  if (!entries.length) return <span className="muted">None</span>

  return (
    <div className="stack" style={{ gap: 2 }}>
      {entries.map(([currency, cents]) => <strong key={currency}>{formatMoney(cents, currency as never)}</strong>)}
    </div>
  )
}

function PeriodTotals({ totals }: { totals: UnitBillingSummaryRow['currentYear'] }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div><span className="muted">Work cost</span><Totals totals={totals.workCosts} /></div>
      <div><span className="muted">Tenant bill-back</span><Totals totals={totals.tenantBillbacks} /></div>
    </div>
  )
}

export function UnitBillingSummary({ rows, currentYear }: { rows: UnitBillingSummaryRow[], currentYear: number }) {
  return (
    <section className="card stack" id="unit-billing">
      <div>
        <div className="kicker">Unit billing</div>
        <h3 style={{ marginTop: 4 }}>Tenant charges by unit</h3>
        <div className="muted">Approved costs for completed work and tenant bill-backs recorded through Simeonware. Final invoices replace earlier approved estimates.</div>
      </div>
      <div className="tableWrap unitBillingTableWrap">
        <table className="unitBillingTable">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Current tenant</th>
              <th>{currentYear}</th>
              <th>{currentYear - 1}</th>
              <th>Current tenancy</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.unitId}>
                <td><Link href={`/units/${row.unitId}`}><strong>{row.propertyName} - {row.unitLabel}</strong></Link></td>
                <td>
                  <div>{row.currentTenantNames.join(', ') || 'No active tenant'}</div>
                  {row.currentTenancyStartedAt ? <div className="muted">Since {formatDateOnly(row.currentTenancyStartedAt)}</div> : null}
                </td>
                <td><PeriodTotals totals={row.currentYear} /></td>
                <td><PeriodTotals totals={row.previousYear} /></td>
                <td>{row.currentTenancyStartedAt ? <PeriodTotals totals={row.currentTenancy} /> : <span className="muted">No tenancy start</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <div className="emptyState"><strong>No units yet</strong><span>Add units before reviewing billing by unit.</span></div> : null}
    </section>
  )
}
