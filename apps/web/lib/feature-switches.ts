export type EmergencyFeature =
  | 'automation'
  | 'notifications'
  | 'quickbooks'
  | 'stripeWrites'
  | 'translation'
  | 'uploads'

const ENV_BY_FEATURE: Record<EmergencyFeature, string> = {
  automation: 'EMERGENCY_DISABLE_AUTOMATION',
  notifications: 'EMERGENCY_DISABLE_OUTBOUND_NOTIFICATIONS',
  quickbooks: 'EMERGENCY_DISABLE_QUICKBOOKS',
  stripeWrites: 'EMERGENCY_DISABLE_STRIPE_WRITES',
  translation: 'EMERGENCY_DISABLE_TRANSLATION',
  uploads: 'EMERGENCY_DISABLE_UPLOADS',
}

const TRUE_VALUES = new Set(['1', 'on', 'true', 'yes'])

export function isEmergencyFeatureDisabled(feature: EmergencyFeature) {
  return TRUE_VALUES.has((process.env[ENV_BY_FEATURE[feature]] ?? '').trim().toLowerCase())
}

export function activeEmergencyFeatures() {
  return (Object.keys(ENV_BY_FEATURE) as EmergencyFeature[]).filter(isEmergencyFeatureDisabled)
}

export function emergencyFeatureMessage(feature: EmergencyFeature) {
  const labels: Record<EmergencyFeature, string> = {
    automation: 'Scheduled automation',
    notifications: 'Email and push delivery',
    quickbooks: 'QuickBooks synchronization',
    stripeWrites: 'Subscription changes',
    translation: 'Automatic translation',
    uploads: 'File uploads',
  }
  return `${labels[feature]} is temporarily paused while we resolve a service issue. Your existing information is safe. Please try again later.`
}

export function assertEmergencyFeatureEnabled(feature: EmergencyFeature) {
  if (isEmergencyFeatureDisabled(feature)) throw new Error(emergencyFeatureMessage(feature))
}
