export const REQUEST_STATUSES = ['new', 'scheduled', 'in_progress', 'done'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  new: ['scheduled', 'in_progress', 'done'],
  scheduled: ['in_progress', 'done'],
  in_progress: ['scheduled', 'done'],
  done: [],
};

export const REQUEST_EVENT_TYPES = [
  'status_changed',
  'comment',
  'vendor_assigned',
  'schedule_set',
  'tenant_update',
] as const;

export type RequestEventType = (typeof REQUEST_EVENT_TYPES)[number];

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export function getRequestStatusLabel(status: RequestStatus): string {
  switch (status) {
    case 'new':
      return 'New';
    case 'scheduled':
      return 'Scheduled';
    case 'in_progress':
      return 'In Progress';
    case 'done':
      return 'Done';
  }
}
