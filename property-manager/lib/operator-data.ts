import { RequestStatus, RequestUrgency } from '@prisma/client';

export function formatDateTime(value: Date | null | undefined): string {
  if (!value) return 'Not scheduled';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

export function formatDate(value: Date | null | undefined): string {
  if (!value) return '—';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

export function getUrgencyClasses(urgency: RequestUrgency): string {
  switch (urgency) {
    case RequestUrgency.EMERGENCY:
      return 'bg-red-100 text-red-800';
    case RequestUrgency.HIGH:
      return 'bg-amber-100 text-amber-800';
    case RequestUrgency.MEDIUM:
      return 'bg-blue-100 text-blue-800';
    case RequestUrgency.LOW:
      return 'bg-slate-100 text-slate-700';
  }
}

export function getStatusClasses(status: RequestStatus): string {
  switch (status) {
    case RequestStatus.NEW:
      return 'bg-slate-100 text-slate-700';
    case RequestStatus.SCHEDULED:
      return 'bg-violet-100 text-violet-800';
    case RequestStatus.IN_PROGRESS:
      return 'bg-sky-100 text-sky-800';
    case RequestStatus.DONE:
      return 'bg-emerald-100 text-emerald-800';
  }
}
