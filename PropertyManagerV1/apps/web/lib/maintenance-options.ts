import type { Urgency } from '@/lib/types'

export const REQUEST_CATEGORIES = [
  'Plumbing',
  'HVAC',
  'Electrical',
  'Appliance',
  'Exterior',
  'Pest',
  'Safety',
  'Other',
] as const

export const REQUEST_URGENCIES: Urgency[] = ['low', 'medium', 'high', 'urgent']
