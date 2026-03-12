import { RequestEventType, RequestStatus } from '@prisma/client';

export const REQUEST_STATUSES = [
  RequestStatus.NEW,
  RequestStatus.SCHEDULED,
  RequestStatus.IN_PROGRESS,
  RequestStatus.DONE,
] as const;

export const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.NEW]: [RequestStatus.SCHEDULED, RequestStatus.IN_PROGRESS, RequestStatus.DONE],
  [RequestStatus.SCHEDULED]: [RequestStatus.IN_PROGRESS, RequestStatus.DONE],
  [RequestStatus.IN_PROGRESS]: [RequestStatus.SCHEDULED, RequestStatus.DONE],
  [RequestStatus.DONE]: [],
};

export const REQUEST_EVENT_TYPES = [
  RequestEventType.STATUS_CHANGED,
  RequestEventType.COMMENT,
  RequestEventType.VENDOR_ASSIGNED,
  RequestEventType.SCHEDULE_SET,
  RequestEventType.TENANT_UPDATE,
] as const;

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export function getRequestStatusLabel(status: RequestStatus): string {
  switch (status) {
    case RequestStatus.NEW:
      return 'New';
    case RequestStatus.SCHEDULED:
      return 'Scheduled';
    case RequestStatus.IN_PROGRESS:
      return 'In Progress';
    case RequestStatus.DONE:
      return 'Done';
  }
}

export function getRequestEventTypeLabel(type: RequestEventType): string {
  switch (type) {
    case RequestEventType.STATUS_CHANGED:
      return 'Status changed';
    case RequestEventType.COMMENT:
      return 'Internal note';
    case RequestEventType.VENDOR_ASSIGNED:
      return 'Vendor assigned';
    case RequestEventType.SCHEDULE_SET:
      return 'Schedule set';
    case RequestEventType.TENANT_UPDATE:
      return 'Tenant update';
  }
}
