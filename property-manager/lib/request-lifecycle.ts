import { RequestEventType, UserRole, RequestStatus } from '@prisma/client';

export const REQUEST_STATUSES = [
  RequestStatus.NEW,
  RequestStatus.SCHEDULED,
  RequestStatus.IN_PROGRESS,
  RequestStatus.DONE,
  RequestStatus.CANCELED,
] as const;

export const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.NEW]: [RequestStatus.SCHEDULED, RequestStatus.IN_PROGRESS, RequestStatus.DONE, RequestStatus.CANCELED],
  [RequestStatus.SCHEDULED]: [RequestStatus.IN_PROGRESS, RequestStatus.DONE, RequestStatus.CANCELED],
  [RequestStatus.IN_PROGRESS]: [RequestStatus.SCHEDULED, RequestStatus.DONE, RequestStatus.CANCELED],
  [RequestStatus.DONE]: [],
  [RequestStatus.CANCELED]: [],
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
    case RequestStatus.CANCELED:
      return 'Canceled';
  }
}

export function getRequestEventTypeLabel(type: RequestEventType, actorRole?: UserRole | null): string {
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
      if (actorRole === UserRole.VENDOR) return 'Vendor update';
      if (actorRole === UserRole.OPERATOR) return 'Operator update';
      return 'Tenant update';
  }
}
