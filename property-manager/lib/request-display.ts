import { RequestStatus, VendorResponseStatus } from '@prisma/client';

export type DisplayLanguage = 'en' | 'es';
export type TicketStageKey = 'CREATED' | 'WITH_PROPERTY_MANAGER' | 'WITH_VENDOR' | 'COMPLETED' | 'CANCELED';

const copy = {
  en: {
    languageLabel: 'Language',
    english: 'English',
    spanish: 'Español',
    progressTitle: 'Request progress',
    progressDescription: 'A simple customer-facing view of where this ticket stands right now.',
    completedOn: 'Completed on',
    currentStage: 'Current stage',
    stageLabels: {
      CREATED: 'Created',
      WITH_PROPERTY_MANAGER: 'With Property Manager',
      WITH_VENDOR: 'With Vendor',
      COMPLETED: 'Completed',
      CANCELED: 'Canceled',
    },
    stageDescriptions: {
      CREATED: 'The request has been submitted and recorded.',
      WITH_PROPERTY_MANAGER: 'The property team is reviewing, triaging, or scheduling the work.',
      WITH_VENDOR: 'A vendor is actively assigned, scheduling, or completing the work.',
      COMPLETED: 'The work has been marked complete.',
      CANCELED: 'The request was canceled and will not move forward.',
    },
  },
  es: {
    languageLabel: 'Idioma',
    english: 'English',
    spanish: 'Español',
    progressTitle: 'Progreso de la solicitud',
    progressDescription: 'Una vista simple para el cliente de dónde está este ticket en este momento.',
    completedOn: 'Completado el',
    currentStage: 'Etapa actual',
    stageLabels: {
      CREATED: 'Creado',
      WITH_PROPERTY_MANAGER: 'Con administración',
      WITH_VENDOR: 'Con proveedor',
      COMPLETED: 'Completado',
      CANCELED: 'Cancelado',
    },
    stageDescriptions: {
      CREATED: 'La solicitud fue enviada y registrada.',
      WITH_PROPERTY_MANAGER: 'El equipo de administración está revisando, clasificando o programando el trabajo.',
      WITH_VENDOR: 'Un proveedor ya está asignado, programando o realizando el trabajo.',
      COMPLETED: 'El trabajo fue marcado como completado.',
      CANCELED: 'La solicitud fue cancelada y no seguirá adelante.',
    },
  },
} as const;

export function getDisplayLanguage(value: string | undefined): DisplayLanguage {
  return value === 'es' ? 'es' : 'en';
}

export function getRequestCopy(language: DisplayLanguage) {
  return copy[language];
}

export function getLocalizedDateTime(value: Date | null | undefined, language: DisplayLanguage): string {
  if (!value) return language === 'es' ? 'Sin programar' : 'Not scheduled';

  return new Intl.DateTimeFormat(language === 'es' ? 'es-US' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

export function getTicketStage(input: {
  status: RequestStatus;
  assignedVendorId?: string | null;
  vendorResponseStatus?: VendorResponseStatus | null;
}): TicketStageKey {
  if (input.status === RequestStatus.DONE) {
    return 'COMPLETED';
  }

  if (input.status === RequestStatus.CANCELED) {
    return 'CANCELED';
  }

  if (
    input.assignedVendorId ||
    input.status === RequestStatus.IN_PROGRESS ||
    input.vendorResponseStatus === VendorResponseStatus.ACCEPTED
  ) {
    return 'WITH_VENDOR';
  }

  if (input.status === RequestStatus.SCHEDULED) {
    return 'WITH_PROPERTY_MANAGER';
  }

  return 'WITH_PROPERTY_MANAGER';
}

export function getCompletedStages(stage: TicketStageKey): TicketStageKey[] {
  const order: TicketStageKey[] = ['CREATED', 'WITH_PROPERTY_MANAGER', 'WITH_VENDOR', 'COMPLETED', 'CANCELED'];
  return order.slice(0, order.indexOf(stage) + 1);
}
