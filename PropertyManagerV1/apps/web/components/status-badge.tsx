import type { RequestStatus } from '@/lib/types'

export function StatusBadge({ status }: { status: RequestStatus }) {
  const label = status.replace('_', ' ')
  return <span className={`badge ${status}`}>{label}</span>
}
