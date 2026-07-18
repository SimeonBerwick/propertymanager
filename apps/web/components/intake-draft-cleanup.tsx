'use client'

import { useEffect } from 'react'

export function IntakeDraftCleanup({ orgSlug }: { orgSlug?: string }) {
  useEffect(() => {
    const prefix = `pm-intake-draft:${orgSlug ?? 'default'}`
    window.localStorage.removeItem(prefix)
    window.localStorage.removeItem(`${prefix}:manager`)
    window.localStorage.removeItem(`${prefix}:tenant`)
  }, [orgSlug])
  return null
}
