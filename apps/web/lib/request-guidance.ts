import type { MaintenanceRequest, Urgency } from '@/lib/types'
import { REQUEST_CATEGORIES } from '@/lib/maintenance-options'
import { getRequestNextAction } from '@/lib/next-action-engine'

type GuidanceRequest = Pick<MaintenanceRequest,
  'id' | 'status' | 'urgency' | 'reviewState' | 'assignedVendorName' | 'vendorScheduledStart' | 'vendorScheduledEnd' | 'claimedAt'
> & {
  vendorPayableBalanceCents?: number
  vendorPayableTo?: string
}

export const WORKFLOW_STEPS = ['Review', 'Assign vendor', 'Schedule', 'Complete work', 'Close'] as const

const CATEGORY_KEYWORDS: Array<{ category: typeof REQUEST_CATEGORIES[number]; keywords: string[] }> = [
  { category: 'Plumbing', keywords: ['leak', 'pipe', 'sink', 'toilet', 'faucet', 'drain', 'water'] },
  { category: 'HVAC', keywords: ['heat', 'heating', 'air conditioning', 'ac ', 'a/c', 'furnace', 'thermostat'] },
  { category: 'Electrical', keywords: ['power', 'electric', 'outlet', 'breaker', 'light', 'sparking'] },
  { category: 'Appliance', keywords: ['fridge', 'refrigerator', 'oven', 'stove', 'dishwasher', 'washer', 'dryer'] },
  { category: 'Exterior', keywords: ['roof', 'gutter', 'fence', 'gate', 'outside', 'exterior'] },
  { category: 'Pest', keywords: ['pest', 'roach', 'mouse', 'mice', 'rat', 'ants', 'termites'] },
  { category: 'Safety', keywords: ['smoke', 'carbon monoxide', 'gas', 'fire', 'break-in', 'unsafe'] },
]

export function suggestRequestDetails(problem: string, description: string) {
  const text = `${problem} ${description}`.toLowerCase()
  const category = CATEGORY_KEYWORDS.find((option) => option.keywords.some((keyword) => text.includes(keyword)))?.category ?? 'Other'

  let urgency: Urgency = 'medium'
  if (['fire', 'gas leak', 'carbon monoxide', 'sparking', 'flood', 'break-in'].some((keyword) => text.includes(keyword))) urgency = 'urgent'
  else if (['no heat', 'no power', 'active leak', 'overflow', 'unsafe'].some((keyword) => text.includes(keyword))) urgency = 'high'
  else if (['minor', 'slow', 'cosmetic', 'when convenient'].some((keyword) => text.includes(keyword))) urgency = 'low'

  return { category, urgency }
}

export function getWorkflowStep(request: GuidanceRequest) {
  if (request.status === 'closed') return WORKFLOW_STEPS.length
  if (['declined', 'canceled'].includes(request.status)) return 0
  if (request.status === 'completed') return 4
  if (request.status === 'in_progress') return 3
  if (request.status === 'scheduled' || request.vendorScheduledStart) return 3
  if (request.assignedVendorName || request.status === 'vendor_selected') return 2
  if (request.status === 'approved' || request.status === 'reopened') return 1
  return 0
}

export function getRecommendedAction(request: GuidanceRequest) {
  const nextAction = getRequestNextAction(request)
  const tone = nextAction.priority === 'urgent'
    ? 'urgent'
    : nextAction.priority === 'high'
      ? 'review'
      : nextAction.priority === 'low'
        ? 'clear'
        : 'normal'

  return {
    label: nextAction.primaryLabel,
    detail: nextAction.reason,
    href: nextAction.href ?? `/requests/${request.id}#actions`,
    tone: tone as 'urgent' | 'review' | 'clear' | 'normal',
    actionType: nextAction.actionType,
  }
}

export function getAttentionScore(request: GuidanceRequest) {
  if ((request.vendorPayableBalanceCents ?? 0) > 0) return request.status === 'closed' ? 7 : 6
  if (['closed', 'declined', 'canceled'].includes(request.status)) return 0
  let score = request.urgency === 'urgent' ? 8 : request.urgency === 'high' ? 5 : 0
  const recommendation = getRecommendedAction(request)
  if (recommendation.tone === 'urgent') score += 8
  if (recommendation.tone === 'review') score += 5
  if (!request.assignedVendorName) score += 2
  if (!request.claimedAt) score += 1
  return score
}
