'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'pm-theme'

type ThemeMode = 'light' | 'dark'

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const next = saved === 'light' || saved === 'dark' ? saved : preferred
    setTheme(next)
    applyTheme(next)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  return (
    <button type="button" className="button themeToggle" onClick={toggleTheme} aria-label="Toggle color theme">
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
