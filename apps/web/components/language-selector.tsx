'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { localeForCode, SUPPORTED_LOCALES } from '@/lib/localization'
import type { LanguageOption } from '@/lib/types'

function portalForPath(pathname: string) {
  if (pathname === '/mobile' || pathname.startsWith('/mobile/')) return 'tenant'
  if (pathname === '/vendor' || pathname.startsWith('/vendor/')) return 'vendor'
  if (pathname === '/maintenance' || pathname.startsWith('/maintenance/')) return 'staff'
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/account') || pathname.startsWith('/properties') || pathname.startsWith('/requests') || pathname.startsWith('/vendors') || pathname.startsWith('/staff') || pathname.startsWith('/reports') || pathname.startsWith('/ops') || pathname.startsWith('/calendar') || pathname.startsWith('/inspections') || pathname.startsWith('/turns') || pathname.startsWith('/workflows') || pathname.startsWith('/access')) return 'manager'
  return 'public'
}

export function LanguageSelector({ initialLanguage, hasSavedPreference = false, localizationEnabled = true }: { initialLanguage: LanguageOption; hasSavedPreference?: boolean; localizationEnabled?: boolean }) {
  const pathname = usePathname()
  const [language, setLanguage] = useState(initialLanguage)
  const [saving, setSaving] = useState(false)
  const [suggestedLanguage, setSuggestedLanguage] = useState<LanguageOption | null>(null)

  useEffect(() => {
    if (!localizationEnabled || hasSavedPreference || initialLanguage !== 'english' || localStorage.getItem('pm-language-suggestion-dismissed')) return
    const suggested = localeForCode(navigator.language)
    if (suggested.language !== 'english') setSuggestedLanguage(suggested.language)
  }, [hasSavedPreference, initialLanguage, localizationEnabled])

  async function changeLanguage(nextLanguage: LanguageOption) {
    setLanguage(nextLanguage)
    setSaving(true)
    try {
      const response = await fetch('/api/localization/preference', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ language: nextLanguage, portal: portalForPath(pathname) }),
      })
      if (!response.ok) throw new Error('Language preference could not be saved.')
      const portal = portalForPath(pathname)
      if (portal === 'public') {
        const currentPrefix = SUPPORTED_LOCALES.find((locale) => pathname === `/${locale.code.toLowerCase()}` || pathname.startsWith(`/${locale.code.toLowerCase()}/`))
        const unprefixed = currentPrefix ? pathname.slice(currentPrefix.code.length + 1) || '/' : pathname
        const nextLocale = SUPPORTED_LOCALES.find((locale) => locale.language === nextLanguage)
        const nextPath = nextLanguage === 'english' ? unprefixed : `/${nextLocale?.code.toLowerCase()}${unprefixed === '/' ? '' : unprefixed}`
        window.location.assign(`${nextPath}${window.location.search}${window.location.hash}`)
      } else {
        window.location.reload()
      }
    } catch (error) {
      console.error(error)
      setLanguage(initialLanguage)
      setSaving(false)
    }
  }

  return (
    <div className="languageSelectorWrap" data-no-localize>
      <label className="languageSelector">
        <span className="srOnly">Language</span>
        <select
          aria-label="Language"
          value={language}
          disabled={saving}
          onChange={(event) => void changeLanguage(event.target.value as LanguageOption)}
        >
          {SUPPORTED_LOCALES.filter((locale) => localizationEnabled || locale.language === 'english').map((locale) => (
            <option key={locale.language} value={locale.language}>{locale.label}</option>
          ))}
        </select>
      </label>
      {!localizationEnabled ? <span className="languagePlanBadge">Growth + Pro</span> : null}
      {suggestedLanguage ? (
        <div className="languageSuggestion" role="status">
          <span>Use {SUPPORTED_LOCALES.find((locale) => locale.language === suggestedLanguage)?.label}?</span>
          <button type="button" onClick={() => void changeLanguage(suggestedLanguage)}>Use</button>
          <button type="button" onClick={() => { localStorage.setItem('pm-language-suggestion-dismissed', '1'); setSuggestedLanguage(null) }}>No</button>
        </div>
      ) : null}
    </div>
  )
}
