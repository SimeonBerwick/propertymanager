'use client'

import { useEffect } from 'react'

export function IntakeDraftCleanup({ orgSlug }: { orgSlug?: string }) {
  useEffect(() => {
    window.localStorage.removeItem(`pm-intake-draft:${orgSlug ?? 'default'}`)
  }, [orgSlug])
  return null
}
