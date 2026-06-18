import { deriveRequestCloseoutLanguage } from '@/lib/request-closeout-language'
import type { RequestStatus } from '@/lib/types'

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={`badge ${status}`}>{deriveRequestCloseoutLanguage({ status }).managerLabel}</span>
}
