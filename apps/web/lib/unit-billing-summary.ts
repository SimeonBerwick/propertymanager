import { prisma } from '@/lib/prisma'

type MoneyTotals = Record<string, number>

export interface PeriodCostTotals {
  workCosts: MoneyTotals
  tenantBillbacks: MoneyTotals
}

interface UnitBillingSource {
  id: string
  label: string
  property: { name: string }
  tenantIdentities: Array<{
    tenantName: string
    leaseStartDate: Date | null
    createdAt: Date
  }>
  requests: Array<{
    status: string
    preferredCurrency: string
    actualCompletedAt: Date | null
    closedAt: Date | null
    tenantBillbackDecision: string
    tenantBillbackAmountCents: number
    tenantBillbackDecidedAt: Date | null
    dispatchHistory: Array<{ createdAt: Date }>
    vendorCommercialItems: Array<{
      itemType: string
      status: string
      currency: string
      amountCents: number
      submittedAt: Date
    }>
  }>
}

export interface UnitBillingSummaryRow {
  unitId: string
  propertyName: string
  unitLabel: string
  currentTenantNames: string[]
  currentTenancyStartedAt: Date | null
  currentYear: PeriodCostTotals
  previousYear: PeriodCostTotals
  currentTenancy: PeriodCostTotals
}

function addAmount(totals: MoneyTotals, currency: string, amountCents: number) {
  totals[currency] = (totals[currency] ?? 0) + amountCents
}

export function summarizeUnitBilling(units: UnitBillingSource[], now = new Date()): UnitBillingSummaryRow[] {
  const currentYearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  const nextYearStart = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1))
  const previousYearStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1))

  return units.map((unit) => {
    const tenancyDates = unit.tenantIdentities.map((tenant) => tenant.leaseStartDate ?? tenant.createdAt)
    const currentTenancyStartedAt = tenancyDates.length
      ? new Date(Math.min(...tenancyDates.map((date) => date.getTime())))
      : null
    const currentYear: PeriodCostTotals = { workCosts: {}, tenantBillbacks: {} }
    const previousYear: PeriodCostTotals = { workCosts: {}, tenantBillbacks: {} }
    const currentTenancy: PeriodCostTotals = { workCosts: {}, tenantBillbacks: {} }

    for (const request of unit.requests) {
      const completedDispatchAt = request.dispatchHistory[0]?.createdAt ?? null
      const completedAt = request.actualCompletedAt ?? completedDispatchAt ?? request.closedAt
      const approvedItems = request.vendorCommercialItems.filter((item) => item.status === 'approved')
      const finalInvoice = approvedItems.find((item) => item.itemType === 'bill_to_property_manager')
      const workItems = finalInvoice
        ? [finalInvoice]
        : approvedItems
      const workCosts = workItems.reduce<MoneyTotals>((totals, item) => {
        addAmount(totals, item.currency, item.amountCents)
        return totals
      }, {})

      if (completedAt) {
        for (const [currency, cents] of Object.entries(workCosts)) {
          if (completedAt >= currentYearStart && completedAt < nextYearStart) addAmount(currentYear.workCosts, currency, cents)
          if (completedAt >= previousYearStart && completedAt < currentYearStart) addAmount(previousYear.workCosts, currency, cents)
          if (currentTenancyStartedAt && completedAt >= currentTenancyStartedAt) addAmount(currentTenancy.workCosts, currency, cents)
        }
      }

      if (request.tenantBillbackDecision === 'bill_tenant' && request.tenantBillbackAmountCents > 0) {
        const decidedAt = request.tenantBillbackDecidedAt ?? completedAt
        if (!decidedAt) continue
        if (decidedAt >= currentYearStart && decidedAt < nextYearStart) addAmount(currentYear.tenantBillbacks, request.preferredCurrency, request.tenantBillbackAmountCents)
        if (decidedAt >= previousYearStart && decidedAt < currentYearStart) addAmount(previousYear.tenantBillbacks, request.preferredCurrency, request.tenantBillbackAmountCents)
        if (currentTenancyStartedAt && decidedAt >= currentTenancyStartedAt) addAmount(currentTenancy.tenantBillbacks, request.preferredCurrency, request.tenantBillbackAmountCents)
      }
    }

    return {
      unitId: unit.id,
      propertyName: unit.property.name,
      unitLabel: unit.label,
      currentTenantNames: unit.tenantIdentities.map((tenant) => tenant.tenantName),
      currentTenancyStartedAt,
      currentYear,
      previousYear,
      currentTenancy,
    }
  })
}

export async function getUnitBillingSummary(ownerId: string, now = new Date()) {
  const units = await prisma.unit.findMany({
    where: { property: { ownerId }, locationType: 'residential' },
    select: {
      id: true,
      label: true,
      property: { select: { name: true } },
      tenantIdentities: {
        where: { status: 'active' },
        select: { tenantName: true, leaseStartDate: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
      requests: {
        select: {
          status: true,
          preferredCurrency: true,
          actualCompletedAt: true,
          closedAt: true,
          tenantBillbackDecision: true,
          tenantBillbackAmountCents: true,
          tenantBillbackDecidedAt: true,
          dispatchHistory: {
            where: { status: 'completed' },
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          vendorCommercialItems: {
            where: { status: 'approved' },
            select: { itemType: true, status: true, currency: true, amountCents: true, submittedAt: true },
            orderBy: { submittedAt: 'desc' },
          },
        },
      },
    },
    orderBy: [{ property: { name: 'asc' } }, { label: 'asc' }],
  })

  return summarizeUnitBilling(units, now)
}
