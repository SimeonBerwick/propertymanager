import type {
  MaintenancePhoto,
  MaintenanceRequest,
  Property,
  RequestComment,
  RequestStatus,
  StatusEvent,
  Unit,
  Vendor,
  VendorDispatchEvent,
  RequestTenderView,
} from '@/lib/types'
import type { BillingDocumentView } from '@/lib/billing-types'
import { prisma } from '@/lib/prisma'

export interface DashboardRequestRow extends MaintenanceRequest {
  propertyName: string
  propertyAddress: string
  unitLabel: string
}

export interface DashboardData {
  properties: Property[]
  requestRows: DashboardRequestRow[]
  statusCounts: Record<RequestStatus, number>
  queueCounts: {
    nonEnglishOpen: number
    nonUsdOpen: number
    priorityOpen: number
    reassignmentNeeded: number
    completedPendingReview: number
    needsFollowUp: number
    scheduledToday: number
    overdueScheduled: number
    unclaimedOpen: number
    staleClaimedOpen: number
    myClaimsOpen: number
  }
}

export interface PropertyDetailData {
  property: Property
  units: Unit[]
  requests: DashboardRequestRow[]
}

export interface RequestDetailData {
  request: DashboardRequestRow
  comments: RequestComment[]
  events: StatusEvent[]
  photos: MaintenancePhoto[]
  recommendedVendors: Vendor[]
  dispatchHistory: VendorDispatchEvent[]
  tenders: RequestTenderView[]
  billingDocuments: BillingDocumentView[]
}

// Prisma includes are typed inline; using any here keeps the mapper simple and
// avoids re-declaring complex generated Prisma types in app code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProperty(p: any): Property {
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    isActive: p.isActive !== false,
    unitCount: p._count?.units ?? 0,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUnit(u: any): Unit {
  return {
    id: u.id,
    propertyId: u.propertyId,
    label: u.label,
    tenantName: u.tenantName ?? undefined,
    tenantEmail: u.tenantEmail ?? undefined,
    isActive: u.isActive !== false,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRequestRow(r: any, claimedByUserName?: string): DashboardRequestRow {
  return {
    id: r.id,
    propertyId: r.propertyId,
    unitId: r.unitId,
    submittedByName: r.submittedByName ?? undefined,
    submittedByEmail: r.submittedByEmail ?? undefined,
    preferredCurrency: r.preferredCurrency,
    preferredLanguage: r.preferredLanguage,
    title: r.title,
    description: r.description,
    category: r.category,
    urgency: r.urgency as MaintenanceRequest['urgency'],
    status: r.status as MaintenanceRequest['status'],
    assignedVendorId: r.assignedVendorId ?? undefined,
    assignedVendorName: r.assignedVendorName ?? undefined,
    assignedVendorEmail: r.assignedVendorEmail ?? undefined,
    assignedVendorPhone: r.assignedVendorPhone ?? undefined,
    assignedVendorIds: r.assignedVendorId ? [r.assignedVendorId] : [],
    assignedVendorNames: r.assignedVendorName ? [r.assignedVendorName] : [],
    dispatchStatus: r.dispatchStatus ?? undefined,
    vendorScheduledStart: r.vendorScheduledStart ? new Date(r.vendorScheduledStart).toISOString() : undefined,
    vendorScheduledEnd: r.vendorScheduledEnd ? new Date(r.vendorScheduledEnd).toISOString() : undefined,
    reviewState: r.reviewState ?? undefined,
    reviewNote: r.reviewNote ?? undefined,
    autoFlag: r.autoFlag ?? undefined,
    autoFlaggedAt: r.autoFlaggedAt ? new Date(r.autoFlaggedAt).toISOString() : undefined,
    firstReviewedAt: r.firstReviewedAt ? new Date(r.firstReviewedAt).toISOString() : undefined,
    claimedAt: r.claimedAt ? new Date(r.claimedAt).toISOString() : undefined,
    claimedByUserId: r.claimedByUserId ?? undefined,
    claimedByUserName: claimedByUserName ?? undefined,
    slaBucket: r.slaBucket ?? undefined,
    triageTags: csvToList(r.triageTagsCsv),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    closedAt: r.closedAt ? new Date(r.closedAt).toISOString() : undefined,
    propertyName: r.property?.name ?? 'Unknown property',
    propertyAddress: r.property?.address ?? 'Unknown address',
    unitLabel: r.unit?.label ?? 'Unknown unit',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPhoto(photo: any): MaintenancePhoto {
  return {
    id: photo.id,
    imageUrl: photo.imageUrl,
    source: photo.source,
    sourceLabel: photo.sourceLabel ?? undefined,
    dispatchEventId: photo.dispatchEventId ?? undefined,
    createdAt: photo.createdAt instanceof Date ? photo.createdAt.toISOString() : String(photo.createdAt),
  }
}

function countStatuses(rows: DashboardRequestRow[]): Record<RequestStatus, number> {
  return {
    new: rows.filter((r) => r.status === 'new').length,
    scheduled: rows.filter((r) => r.status === 'scheduled').length,
    in_progress: rows.filter((r) => r.status === 'in_progress').length,
    done: rows.filter((r) => r.status === 'done').length,
  }
}

function queueCounts(rows: DashboardRequestRow[], currentUserId?: string) {
  const openRows = rows.filter((r) => r.status !== 'done')
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  return {
    nonEnglishOpen: openRows.filter((r) => r.preferredLanguage !== 'english').length,
    nonUsdOpen: openRows.filter((r) => r.preferredCurrency !== 'usd').length,
    priorityOpen: openRows.filter((r) => r.slaBucket === 'priority').length,
    reassignmentNeeded: rows.filter((r) => r.reviewState === 'reassignment_needed' || r.reviewState === 'vendor_declined_reassignment_needed').length,
    completedPendingReview: rows.filter((r) => r.reviewState === 'vendor_completed_pending_review').length,
    needsFollowUp: rows.filter((r) => r.reviewState === 'needs_follow_up' || r.reviewState === 'vendor_update_pending_review').length,
    scheduledToday: rows.filter((r) => r.vendorScheduledStart && new Date(r.vendorScheduledStart) >= todayStart && new Date(r.vendorScheduledStart) < todayEnd).length,
    overdueScheduled: rows.filter((r) => r.vendorScheduledEnd && new Date(r.vendorScheduledEnd) < now && r.status !== 'done').length,
    unclaimedOpen: openRows.filter((r) => !r.claimedAt).length,
    staleClaimedOpen: openRows.filter((r) => r.claimedAt && Date.now() - new Date(r.claimedAt).getTime() >= 1000 * 60 * 60 * 24).length,
    myClaimsOpen: currentUserId ? openRows.filter((r) => r.claimedByUserId === currentUserId).length : 0,
  }
}

function buildUserNameMap(users: Array<{ id: string, email: string, displayName: string | null }>) {
  return new Map(users.map((user) => [user.id, user.displayName ?? user.email]))
}

function mapRequestsWithClaimOwners(rows: any[], users: Array<{ id: string, email: string, displayName: string | null }>) {
  const userMap = buildUserNameMap(users)
  return rows.map((row) => mapRequestRow(row, row.claimedByUserId ? userMap.get(row.claimedByUserId) : undefined))
}

function csvToList(value: unknown): string[] {
  return typeof value === 'string'
    ? value.split(',').map((item) => item.trim()).filter(Boolean)
    : []
}

function mapVendor(v: any): Vendor {
  return {
    id: v.id,
    orgId: v.orgId ?? undefined,
    name: v.name,
    email: v.email ?? undefined,
    phone: v.phone ?? undefined,
    categories: csvToList(v.categoriesCsv),
    supportedLanguages: csvToList(v.supportedLanguagesCsv) as Vendor['supportedLanguages'],
    supportedCurrencies: csvToList(v.supportedCurrenciesCsv) as Vendor['supportedCurrencies'],
    isActive: Boolean(v.isActive),
  }
}

function vendorMatchScore(request: DashboardRequestRow, vendor: Vendor): number {
  let score = 0
  if (vendor.categories.includes(request.category)) score += 3
  if (vendor.supportedLanguages.includes(request.preferredLanguage)) score += 3
  if (vendor.supportedCurrencies.includes(request.preferredCurrency)) score += 2
  return score
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  try {
    const [dbProperties, dbRequests, claimUsers] = await Promise.all([
      prisma.property.findMany({
        where: { ownerId: userId, isActive: true },
        include: { _count: { select: { units: true } } },
      }),
      prisma.maintenanceRequest.findMany({
        where: { property: { ownerId: userId } },
        include: { property: true, unit: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.findMany({
        where: { id: { in: (await prisma.maintenanceRequest.findMany({ where: { property: { ownerId: userId }, claimedByUserId: { not: null } }, select: { claimedByUserId: true } })).map((r) => r.claimedByUserId!).filter(Boolean) } },
        select: { id: true, email: true, displayName: true },
      }),
    ])
    const requestRows = mapRequestsWithClaimOwners(dbRequests, claimUsers)
    return {
      properties: dbProperties.map(mapProperty),
      requestRows,
      statusCounts: countStatuses(requestRows),
      queueCounts: queueCounts(requestRows, userId),
    }
  } catch {
    return { properties: [], requestRows: [], statusCounts: countStatuses([]), queueCounts: queueCounts([], userId) }
  }
}

export async function getLandlordBySlug(slug: string): Promise<{ id: string } | null> {
  try {
    return await prisma.user.findUnique({ where: { slug }, select: { id: true } })
  } catch {
    return null
  }
}

export async function getProperties(userId?: string, orgSlug?: string, includeInactive = false): Promise<Property[]> {
  try {
    let where: Record<string, unknown> | undefined
    if (userId) where = { ownerId: userId, ...(includeInactive ? {} : { isActive: true }) }
    else if (orgSlug) where = { owner: { slug: orgSlug }, isActive: true }
    const dbProperties = await prisma.property.findMany({
      where,
      include: { _count: { select: { units: true } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    })
    return dbProperties.map(mapProperty)
  } catch {
    return []
  }
}

export async function getAllUnits(userId?: string, orgSlug?: string, includeInactive = false): Promise<Unit[]> {
  try {
    let where: Record<string, unknown> | undefined
    if (userId) where = { property: { ownerId: userId }, ...(includeInactive ? {} : { isActive: true }) }
    else if (orgSlug) where = { property: { owner: { slug: orgSlug } }, isActive: true }
    const dbUnits = await prisma.unit.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { propertyId: 'asc' }, { label: 'asc' }],
    })
    return dbUnits.map(mapUnit)
  } catch {
    return []
  }
}

export async function getPropertyDetailData(propertyId: string, userId: string): Promise<PropertyDetailData | null> {
  try {
    const dbProperty = await prisma.property.findFirst({
      where: { id: propertyId, ownerId: userId },
      include: {
        _count: { select: { units: true } },
        units: { orderBy: [{ isActive: 'desc' }, { label: 'asc' }] },
        requests: { include: { property: true, unit: true }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!dbProperty) return null
    return {
      property: mapProperty(dbProperty),
      units: dbProperty.units.map(mapUnit),
      requests: mapRequestsWithClaimOwners(dbProperty.requests, await prisma.user.findMany({ where: { id: { in: dbProperty.requests.map((r) => r.claimedByUserId).filter(Boolean) as string[] } }, select: { id: true, email: true, displayName: true } })),
    }
  } catch {
    return null
  }
}

export async function getRequestDetailData(requestId: string, userId: string): Promise<RequestDetailData | null> {
  try {
    const dbRequest = await prisma.maintenanceRequest.findFirst({
      where: { id: requestId, property: { ownerId: userId } },
      include: {
        property: true,
        unit: true,
        photos: { orderBy: { createdAt: 'asc' } },
        comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
        events: { include: { actorUser: true }, orderBy: { createdAt: 'asc' } },
        dispatchHistory: { include: { vendor: true, actorUser: true }, orderBy: { createdAt: 'asc' } },
        billingDocuments: {
          orderBy: { createdAt: 'desc' },
          include: {
            events: {
              orderBy: { createdAt: 'desc' },
              include: { actorUser: true },
            },
          },
        },
        tenders: {
          orderBy: { createdAt: 'desc' },
          include: {
            invites: {
              orderBy: { invitedAt: 'asc' },
              include: { vendor: true },
            },
          },
        },
      },
    })
    if (!dbRequest) return null

    const comments: RequestComment[] = dbRequest.comments.map((c) => ({
      id: c.id,
      requestId: c.requestId,
      authorName: c.author?.displayName ?? c.author?.email ?? 'System',
      body: c.body,
      visibility: c.visibility as 'internal' | 'external',
      createdAt: c.createdAt.toISOString(),
    }))

    const events: StatusEvent[] = dbRequest.events.map((e) => ({
      id: e.id,
      requestId: e.requestId,
      fromStatus: e.fromStatus as RequestStatus | undefined,
      toStatus: e.toStatus as RequestStatus,
      actorName: e.actorUser?.displayName ?? e.actorUser?.email ?? 'System',
      createdAt: e.createdAt.toISOString(),
    }))

    const claimUsers = dbRequest.claimedByUserId
      ? await prisma.user.findMany({ where: { id: dbRequest.claimedByUserId }, select: { id: true, email: true, displayName: true } })
      : []

    const request = mapRequestsWithClaimOwners([dbRequest], claimUsers)[0]

    const vendorRows = await prisma.vendor.findMany({
      where: { orgId: userId, isActive: true },
      orderBy: { name: 'asc' },
    })

    const recommendedVendors = vendorRows
      .map(mapVendor)
      .map((vendor) => ({ vendor, score: vendorMatchScore(request, vendor) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.vendor.name.localeCompare(b.vendor.name))
      .slice(0, 5)
      .map(({ vendor }) => vendor)

    const dispatchHistory: VendorDispatchEvent[] = dbRequest.dispatchHistory.map((entry) => ({
      id: entry.id,
      requestId: entry.requestId,
      vendorName: entry.vendor?.name ?? undefined,
      actorName: entry.actorUser?.displayName ?? entry.actorUser?.email ?? 'System',
      status: entry.status as VendorDispatchEvent['status'],
      note: entry.note ?? undefined,
      scheduledStart: entry.scheduledStart?.toISOString() ?? undefined,
      scheduledEnd: entry.scheduledEnd?.toISOString() ?? undefined,
      createdAt: entry.createdAt.toISOString(),
    }))

    const billingDocuments: BillingDocumentView[] = dbRequest.billingDocuments.map((doc) => ({
      id: doc.id,
      requestId: doc.requestId,
      recipientType: doc.recipientType as BillingDocumentView['recipientType'],
      documentType: doc.documentType as BillingDocumentView['documentType'],
      status: doc.status as BillingDocumentView['status'],
      currency: doc.currency as BillingDocumentView['currency'],
      totalCents: doc.totalCents,
      paidCents: doc.paidCents,
      title: doc.title,
      description: doc.description ?? undefined,
      pdfUrl: doc.pdfUrl ?? undefined,
      sentTo: doc.sentTo ?? undefined,
      sentAt: doc.sentAt?.toISOString() ?? undefined,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      events: doc.events.map((event) => ({
        id: event.id,
        billingDocumentId: event.billingDocumentId,
        eventType: event.eventType,
        note: event.note ?? undefined,
        actorName: event.actorUser?.displayName ?? event.actorUser?.email ?? undefined,
        createdAt: event.createdAt.toISOString(),
      })),
    }))

    const tenders: RequestTenderView[] = dbRequest.tenders.map((tender) => ({
      id: tender.id,
      status: tender.status,
      title: tender.title ?? undefined,
      note: tender.note ?? undefined,
      sentAt: tender.sentAt?.toISOString() ?? undefined,
      awardedAt: tender.awardedAt?.toISOString() ?? undefined,
      createdAt: tender.createdAt.toISOString(),
      invites: tender.invites.map((invite) => ({
        id: invite.id,
        vendorId: invite.vendorId,
        vendorName: invite.vendor.name,
        vendorEmail: invite.vendor.email ?? undefined,
        status: invite.status,
        bidAmountCents: invite.bidAmountCents ?? undefined,
        bidCurrency: invite.bidCurrency ?? undefined,
        availabilityNote: invite.availabilityNote ?? undefined,
        proposedStart: invite.proposedStart?.toISOString() ?? undefined,
        proposedEnd: invite.proposedEnd?.toISOString() ?? undefined,
        invitedAt: invite.invitedAt.toISOString(),
        respondedAt: invite.respondedAt?.toISOString() ?? undefined,
        awardedAt: invite.awardedAt?.toISOString() ?? undefined,
      })),
    }))

    return {
      request,
      comments,
      events,
      photos: dbRequest.photos.map(mapPhoto),
      recommendedVendors,
      dispatchHistory,
      tenders,
      billingDocuments,
    }
  } catch {
    return null
  }
}

export interface PropertyStats {
  propertyId: string
  propertyName: string
  propertyAddress: string
  totalCount: number
  openCount: number
  closedCount: number
}

export interface AgingRequest extends DashboardRequestRow {
  ageDays: number
}

export interface RepeatIssueGroup {
  unitId: string
  unitLabel: string
  propertyId: string
  propertyName: string
  category: string
  count: number
  requestIds: string[]
  requestTitles: string[]
}

export interface VendorScorecard {
  vendorId: string
  vendorName: string
  assignmentCount: number
  acceptedCount: number
  declinedCount: number
  completedCount: number
  avgCompletionDays: number | null
}

export interface OperatorQueueMetric {
  operatorId: string
  operatorName: string
  openClaims: number
  staleClaims: number
  avgClaimAgeHours: number | null
  completedClaims: number
}

export interface TrendPoint {
  day: string
  created: number
  firstReviewed: number
  claimed: number
  completed: number
}

export interface TrendAlert {
  kind: 'review_backlog' | 'completion_backlog'
  message: string
  severity: 'warn' | 'critical'
}

export interface ReportData {
  propertyStats: PropertyStats[]
  agingRequests: AgingRequest[]
  repeatIssues: RepeatIssueGroup[]
  totalOpen: number
  totalClosed: number
  avgTimeToAssignHours: number | null
  avgTimeToScheduleHours: number | null
  avgTimeToCompleteDays: number | null
  avgTimeToFirstReviewHours: number | null
  avgClaimAgeHoursOpen: number | null
  unclaimedOpenCount: number
  staleClaimedOpenCount: number
  reopenCount: number
  vendorScorecards: VendorScorecard[]
  operatorMetrics: OperatorQueueMetric[]
  trends: TrendPoint[]
  trendAlerts: TrendAlert[]
}

export interface UnitDetailData {
  unit: Unit
  property: Property
  requests: DashboardRequestRow[]
  openCount: number
  closedCount: number
}

export interface VendorDetailData {
  vendor: Vendor
  requests: DashboardRequestRow[]
  scorecard: VendorScorecard | null
}

function buildDailyTrends(rows: DashboardRequestRow[], days = 14): TrendPoint[] {
  const points: TrendPoint[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const start = new Date(today)
    start.setDate(today.getDate() - offset)
    const end = new Date(start)
    end.setDate(start.getDate() + 1)
    const inWindow = (value?: string) => !!value && new Date(value) >= start && new Date(value) < end

    points.push({
      day: start.toISOString().slice(0, 10),
      created: rows.filter((row) => inWindow(row.createdAt)).length,
      firstReviewed: rows.filter((row) => inWindow(row.firstReviewedAt)).length,
      claimed: rows.filter((row) => inWindow(row.claimedAt)).length,
      completed: rows.filter((row) => row.status === 'done' && inWindow(row.closedAt)).length,
    })
  }

  return points
}

function buildTrendAlerts(trends: TrendPoint[]): TrendAlert[] {
  const recent = trends.slice(-3)
  if (recent.length < 3) return []

  const createdBeatsReviewed = recent.every((point) => point.created > point.firstReviewed)
  const createdBeatsCompleted = recent.every((point) => point.created > point.completed)
  const alerts: TrendAlert[] = []

  if (createdBeatsReviewed) {
    alerts.push({
      kind: 'review_backlog',
      severity: 'warn',
      message: 'New request intake has exceeded first reviews for 3 straight days.',
    })
  }

  if (createdBeatsCompleted) {
    alerts.push({
      kind: 'completion_backlog',
      severity: 'critical',
      message: 'New request intake has exceeded completions for 3 straight days.',
    })
  }

  return alerts
}

function groupRepeatIssues(rows: DashboardRequestRow[]): RepeatIssueGroup[] {
  const grouped = new Map<string, DashboardRequestRow[]>()
  for (const r of rows) {
    const key = `${r.unitId}__${r.category}`
    const group = grouped.get(key) ?? []
    group.push(r)
    grouped.set(key, group)
  }
  const result: RepeatIssueGroup[] = []
  for (const [key, reqs] of grouped.entries()) {
    if (reqs.length >= 2) {
      const splitAt = key.indexOf('__')
      const unitId = key.slice(0, splitAt)
      const category = key.slice(splitAt + 2)
      const first = reqs[0]
      result.push({
        unitId,
        unitLabel: first.unitLabel,
        propertyId: first.propertyId,
        propertyName: first.propertyName,
        category,
        count: reqs.length,
        requestIds: reqs.map((r) => r.id),
        requestTitles: reqs.map((r) => r.title),
      })
    }
  }
  return result.sort((a, b) => b.count - a.count)
}

export async function getReportData(userId: string): Promise<ReportData> {
  const now = new Date()
  try {
    const [dbProperties, openDbRequests, allDbRequests, dispatchEvents, vendors] = await Promise.all([
      prisma.property.findMany({
        where: { ownerId: userId },
        include: {
          _count: { select: { units: true } },
          requests: { select: { id: true, status: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.maintenanceRequest.findMany({
        where: { status: { not: 'done' }, property: { ownerId: userId } },
        include: { property: true, unit: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.maintenanceRequest.findMany({
        where: { property: { ownerId: userId } },
        include: { property: true, unit: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vendorDispatchEvent.findMany({
        where: { request: { property: { ownerId: userId } } },
        include: { vendor: true, request: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.vendor.findMany({
        where: { orgId: userId },
        orderBy: { name: 'asc' },
      }),
    ])

    const propertyStats: PropertyStats[] = dbProperties.map((p) => ({
      propertyId: p.id,
      propertyName: p.name,
      propertyAddress: p.address,
      totalCount: p.requests.length,
      openCount: p.requests.filter((r) => r.status !== 'done').length,
      closedCount: p.requests.filter((r) => r.status === 'done').length,
    }))

    const claimUsers = await prisma.user.findMany({
      where: { id: { in: Array.from(new Set(allDbRequests.map((r) => r.claimedByUserId).filter(Boolean))) as string[] } },
      select: { id: true, email: true, displayName: true },
    })
    const claimUserMap = buildUserNameMap(claimUsers)

    const agingRequests: AgingRequest[] = openDbRequests.map((r) => ({
      ...mapRequestRow(r, r.claimedByUserId ? claimUserMap.get(r.claimedByUserId) : undefined),
      ageDays: Math.floor((now.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    }))

    const allRows = allDbRequests.map((r) => mapRequestRow(r, r.claimedByUserId ? claimUserMap.get(r.claimedByUserId) : undefined))
    const totalOpen = allRows.filter((r) => r.status !== 'done').length
    const totalClosed = allRows.filter((r) => r.status === 'done').length
    const repeatIssues = groupRepeatIssues(allRows)

    const firstReviewDelays = allDbRequests
      .filter((r) => r.firstReviewedAt)
      .map((r) => (r.firstReviewedAt!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60))

    const openClaimAges = openDbRequests
      .filter((r) => r.claimedAt)
      .map((r) => (now.getTime() - r.claimedAt!.getTime()) / (1000 * 60 * 60))

    const assignmentDelays = allDbRequests
      .filter((r) => r.assignedVendorName)
      .map((r) => (r.updatedAt.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60))

    const scheduleDelays = allDbRequests
      .filter((r) => r.vendorScheduledStart)
      .map((r) => (r.vendorScheduledStart!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60))

    const completionDelays = allDbRequests
      .filter((r) => r.closedAt)
      .map((r) => (r.closedAt!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24))

    const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

    const vendorScorecards: VendorScorecard[] = vendors.map((vendor) => {
      const vendorEvents = dispatchEvents.filter((event) => event.vendorId === vendor.id)
      const assignedRequestIds = new Set(vendorEvents.filter((event) => event.status === 'assigned').map((event) => event.requestId))
      const completedRequestIds = new Set(vendorEvents.filter((event) => event.status === 'completed').map((event) => event.requestId))
      const acceptedCount = vendorEvents.filter((event) => event.status === 'accepted').length
      const declinedCount = vendorEvents.filter((event) => event.status === 'declined').length
      const completedDurations = allDbRequests
        .filter((request) => request.assignedVendorId === vendor.id && request.closedAt)
        .map((request) => (request.closedAt!.getTime() - request.createdAt.getTime()) / (1000 * 60 * 60 * 24))

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        assignmentCount: assignedRequestIds.size,
        acceptedCount,
        declinedCount,
        completedCount: completedRequestIds.size,
        avgCompletionDays: avg(completedDurations),
      }
    })

    const operatorMetrics: OperatorQueueMetric[] = claimUsers.map((user) => {
      const claimedRows = allRows.filter((row) => row.claimedByUserId === user.id)
      const openClaims = claimedRows.filter((row) => row.status !== 'done')
      const staleClaims = openClaims.filter((row) => row.claimedAt && now.getTime() - new Date(row.claimedAt).getTime() >= 1000 * 60 * 60 * 24)
      const avgClaimAgeHours = openClaims.length
        ? openClaims.reduce((sum, row) => sum + (row.claimedAt ? (now.getTime() - new Date(row.claimedAt).getTime()) / (1000 * 60 * 60) : 0), 0) / openClaims.length
        : null

      return {
        operatorId: user.id,
        operatorName: user.displayName ?? user.email,
        openClaims: openClaims.length,
        staleClaims: staleClaims.length,
        avgClaimAgeHours,
        completedClaims: claimedRows.filter((row) => row.status === 'done').length,
      }
    }).sort((a, b) => b.openClaims - a.openClaims || b.staleClaims - a.staleClaims || a.operatorName.localeCompare(b.operatorName))

    const trends = buildDailyTrends(allRows)
    const reopenCount = allRows.filter((r) => r.reviewState === 'reopened_after_review').length

    return {
      propertyStats,
      agingRequests,
      repeatIssues,
      totalOpen,
      totalClosed,
      avgTimeToAssignHours: avg(assignmentDelays),
      avgTimeToScheduleHours: avg(scheduleDelays),
      avgTimeToCompleteDays: avg(completionDelays),
      avgTimeToFirstReviewHours: avg(firstReviewDelays),
      avgClaimAgeHoursOpen: avg(openClaimAges),
      unclaimedOpenCount: allRows.filter((r) => r.status !== 'done' && !r.claimedAt).length,
      staleClaimedOpenCount: allRows.filter((r) => r.status !== 'done' && r.claimedAt && now.getTime() - new Date(r.claimedAt).getTime() >= 1000 * 60 * 60 * 24).length,
      reopenCount,
      vendorScorecards,
      operatorMetrics,
      trends,
      trendAlerts: buildTrendAlerts(trends),
    }
  } catch {
    return {
      propertyStats: [],
      agingRequests: [],
      repeatIssues: [],
      totalOpen: 0,
      totalClosed: 0,
      avgTimeToAssignHours: null,
      avgTimeToScheduleHours: null,
      avgTimeToCompleteDays: null,
      avgTimeToFirstReviewHours: null,
      avgClaimAgeHoursOpen: null,
      unclaimedOpenCount: 0,
      staleClaimedOpenCount: 0,
      reopenCount: 0,
      vendorScorecards: [],
      operatorMetrics: [],
      trends: [],
      trendAlerts: [],
    }
  }
}

export async function getVendorDetailData(vendorId: string, userId: string): Promise<VendorDetailData | null> {
  try {
    const [vendorRecord, requestRows, reportData] = await Promise.all([
      prisma.vendor.findFirst({
        where: { id: vendorId, orgId: userId },
      }),
      prisma.maintenanceRequest.findMany({
        where: { assignedVendorId: vendorId, property: { ownerId: userId } },
        include: { property: true, unit: true },
        orderBy: { createdAt: 'desc' },
      }),
      getReportData(userId),
    ])

    if (!vendorRecord) return null

    return {
      vendor: mapVendor(vendorRecord),
      requests: requestRows.map((row) => mapRequestRow(row)),
      scorecard: reportData.vendorScorecards.find((item) => item.vendorId === vendorId) ?? null,
    }
  } catch {
    return null
  }
}

export async function getUnitDetailData(unitId: string, userId: string): Promise<UnitDetailData | null> {
  try {
    const dbUnit = await prisma.unit.findFirst({
      where: { id: unitId, property: { ownerId: userId } },
      include: {
        property: { include: { _count: { select: { units: true } } } },
        requests: { include: { property: true, unit: true }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!dbUnit) return null
    const requests = dbUnit.requests.map((row) => mapRequestRow(row))
    return {
      unit: mapUnit(dbUnit),
      property: mapProperty(dbUnit.property),
      requests,
      openCount: requests.filter((r) => r.status !== 'done').length,
      closedCount: requests.filter((r) => r.status === 'done').length,
    }
  } catch {
    return null
  }
}
