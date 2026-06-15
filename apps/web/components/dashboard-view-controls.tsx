'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { ActionFeedback } from '@/components/action-feedback'

type SavedView = { name: string, query: string }
const STORAGE_KEY = 'pm-dashboard-saved-views'

export function DashboardViewControls() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [views, setViews] = useState<SavedView[]>([])
  const [feedback, setFeedback] = useState<{ message: string, deleted?: SavedView } | null>(null)

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
      if (Array.isArray(parsed)) setViews(parsed.filter((view) => view?.name && typeof view.query === 'string'))
    } catch {
      // Ignore invalid local preferences.
    }
  }, [])

  function persist(next: SavedView[]) {
    setViews(next)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function saveCurrentView() {
    const name = window.prompt('Name this dashboard view')
    if (!name?.trim()) return
    const next = [...views.filter((view) => view.name.toLowerCase() !== name.trim().toLowerCase()), {
      name: name.trim(),
      query: searchParams.toString(),
    }]
    persist(next)
    setFeedback({ message: `Saved view "${name.trim()}".` })
  }

  function deleteView(view: SavedView) {
    persist(views.filter((candidate) => candidate.name !== view.name))
    setFeedback({ message: `Deleted view "${view.name}".`, deleted: view })
  }

  function undoDelete() {
    if (!feedback?.deleted) return
    persist([...views, feedback.deleted])
    setFeedback({ message: `Restored view "${feedback.deleted.name}".` })
  }

  return (
    <div className="savedViews">
      <button type="button" className="button" onClick={saveCurrentView}>Save current view</button>
      {views.map((view) => (
        <span className="savedViewItem" key={view.name}>
          <button type="button" className="filterChip" onClick={() => router.push(`${pathname}${view.query ? `?${view.query}` : ''}` as Route)}>
            {view.name}
          </button>
          <button
            type="button"
            className="savedViewRemove"
            aria-label={`Delete ${view.name} view`}
            onClick={() => deleteView(view)}
          >
            x
          </button>
        </span>
      ))}
      <ActionFeedback success={feedback?.message} onUndo={feedback?.deleted ? undoDelete : undefined} />
    </div>
  )
}
