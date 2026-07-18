'use client'

import { useEffect } from 'react'

export function IntakeDraftCleanup({ orgSlug, managerDraftScope }: { orgSlug?: string; managerDraftScope?: string }) {
  useEffect(() => {
    const prefix = `pm-intake-draft:${orgSlug ?? 'default'}`
    window.localStorage.removeItem(prefix)
    window.localStorage.removeItem(`${prefix}:manager`)
    window.localStorage.removeItem(`${prefix}:tenant`)
    if (managerDraftScope) {
      window.localStorage.removeItem(`pm-intake-draft:manager:${managerDraftScope}`)
    }
  }, [managerDraftScope, orgSlug])
  return null
}
