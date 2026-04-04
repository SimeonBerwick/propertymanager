export type RequestStatus = 'new' | 'scheduled' | 'in_progress' | 'done'
export type Urgency = 'low' | 'medium' | 'high' | 'urgent'
export type CurrencyOption = 'usd' | 'peso' | 'pound' | 'euro'
export type LanguageOption = 'english' | 'spanish' | 'french'

export interface Property {
  id: string
  name: string
  address: string
  unitCount: number
}

export interface Unit {
  id: string
  propertyId: string
  label: string
  tenantName?: string
  tenantEmail?: string
}

export interface MaintenancePhoto {
  id: string
  imageUrl: string
  createdAt: string
}

export interface MaintenanceRequest {
  id: string
  propertyId: string
  unitId: string
  submittedByName?: string
  submittedByEmail?: string
  preferredCurrency: CurrencyOption
  preferredLanguage: LanguageOption
  title: string
  description: string
  category: string
  urgency: Urgency
  status: RequestStatus
  assignedVendorName?: string
  assignedVendorEmail?: string
  assignedVendorPhone?: string
  createdAt: string
}

export interface RequestComment {
  id: string
  requestId: string
  authorName: string
  body: string
  visibility: 'internal' | 'external'
  createdAt: string
}

export interface StatusEvent {
  id: string
  requestId: string
  fromStatus?: RequestStatus
  toStatus: RequestStatus
  actorName: string
  createdAt: string
}

const CURRENCY_LABELS: Record<CurrencyOption, string> = {
  usd: 'US Dollar',
  peso: 'Peso',
  pound: 'Pound',
  euro: 'Euro',
}

const LANGUAGE_LABELS: Record<LanguageOption, string> = {
  english: 'English',
  spanish: 'Spanish',
  french: 'French',
}

export function currencyLabel(value: CurrencyOption): string {
  return CURRENCY_LABELS[value]
}

export function languageLabel(value: LanguageOption): string {
  return LANGUAGE_LABELS[value]
}
