export {
  buildDashboardNextActions,
  getRequestNextAction,
  type NextAction,
  type RequestNextAction,
} from '@/lib/next-action-engine'

export type RecommendedAction = {
  id: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  title: string
  reason: string
  primaryLabel: string
  href?: string
  actionType?: string
  requestId?: string
  group: string
  score: number
}

export function sortRecommendedActions<T extends Pick<RecommendedAction, 'score' | 'title'>>(actions: T[]) {
  return [...actions].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
}

export function groupRecommendedActions<T extends Pick<RecommendedAction, 'group'>>(actions: T[]) {
  const groups = new Map<string, T[]>()
  for (const action of actions) {
    const group = groups.get(action.group) ?? []
    group.push(action)
    groups.set(action.group, group)
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
}

export const groupDashboardNextActions = groupRecommendedActions
