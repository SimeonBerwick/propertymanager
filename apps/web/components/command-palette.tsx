'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'

type SearchResult = {
  href: string
  label: string
  meta: string
  type: string
}

const shortcuts: SearchResult[] = [
  { href: '/dashboard', label: 'Maintenance queue', meta: 'Review and move requests forward', type: 'Go to' },
  { href: '/properties', label: 'Properties', meta: 'Manage properties and units', type: 'Go to' },
  { href: '/vendors', label: 'Vendors', meta: 'Manage vendors and assignments', type: 'Go to' },
  { href: '/ops', label: 'Activity center', meta: 'Review changes and exports', type: 'Go to' },
  { href: '/reports', label: 'Reports', meta: 'View portfolio performance', type: 'Go to' },
  { href: '/submit', label: 'Share request form', meta: 'Open the maintenance intake link', type: 'Action' },
]

export function CommandPalette() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>(shortcuts)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((current) => !current)
      } else if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    const normalized = query.trim()
    if (!normalized) {
      setResults(shortcuts)
      setLoading(false)
      return
    }

    const localMatches = shortcuts.filter((item) =>
      `${item.label} ${item.meta} ${item.type}`.toLowerCase().includes(normalized.toLowerCase()),
    )
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`, { signal: controller.signal })
        const data = response.ok ? await response.json() as { results?: SearchResult[] } : {}
        setResults([...localMatches, ...(data.results ?? [])])
      } catch {
        if (!controller.signal.aborted) setResults(localMatches)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 180)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query])

  function navigate(href: string) {
    setOpen(false)
    setQuery('')
    router.push(href as Route)
  }

  return (
    <>
      <button type="button" className="commandTrigger" onClick={() => setOpen(true)} aria-label="Open search and commands">
        Search <span>Ctrl K</span>
      </button>
      {open ? (
        <div className="commandBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}>
          <section className="commandPalette" role="dialog" aria-modal="true" aria-label="Search and commands">
            <div className="commandInputRow">
              <input
                ref={inputRef}
                className="commandInput"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search requests, properties, vendors, or actions..."
                aria-label="Search"
              />
              <button type="button" className="button" onClick={() => setOpen(false)}>Close</button>
            </div>
            <div className="commandResults">
              {loading ? <div className="commandHint">Searching...</div> : null}
              {!loading && results.length === 0 ? (
                <div className="commandEmpty">
                  <strong>No matches found</strong>
                  <span>Try a request title, property, vendor, or page name.</span>
                </div>
              ) : null}
              {results.map((result, index) => (
                <button
                  type="button"
                  className="commandResult"
                  key={`${result.href}-${index}`}
                  onClick={() => navigate(result.href)}
                >
                  <span className="commandResultType">{result.type}</span>
                  <span><strong>{result.label}</strong><small>{result.meta}</small></span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
