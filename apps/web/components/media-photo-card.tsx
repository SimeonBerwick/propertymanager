'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

type MediaPhotoCardProps = {
  href: string
  src: string
  alt: string
  unavailableLabel?: string
}

export function MediaPhotoCard({
  href,
  src,
  alt,
  unavailableLabel = 'Photo unavailable',
}: MediaPhotoCardProps) {
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const viewerId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const closeViewer = useCallback(() => {
    if (window.history.state?.photoViewer === viewerId) window.history.back()
    else setOpen(false)
  }, [viewerId])

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const closeFromHistory = () => setOpen(false)
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeViewer()
    }
    window.addEventListener('popstate', closeFromHistory)
    window.addEventListener('keydown', closeFromKeyboard)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('popstate', closeFromHistory)
      window.removeEventListener('keydown', closeFromKeyboard)
      previousFocus?.focus()
    }
  }, [closeViewer, open])

  function openViewer() {
    if (failed) return
    window.history.pushState({ ...window.history.state, photoViewer: viewerId }, '', window.location.href)
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        className={`photo-card${failed ? ' is-unavailable' : ''}`}
        disabled={failed}
        aria-label={`Open ${alt}`}
        aria-haspopup="dialog"
        onClick={openViewer}
      >
        {failed ? (
          <span className="photo-fallback">{unavailableLabel}</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="photo-image" onError={() => setFailed(true)} />
        )}
      </button>
      {open ? (
        <div className="photoViewerBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeViewer()
        }}>
          <section className="photoViewer" role="dialog" aria-modal="true" aria-label={alt}>
            <div className="photoViewerToolbar">
              <strong>Photo</strong>
              <div className="row">
                <a className="button" href={href} download>Download photo</a>
                <button className="button primary" type="button" ref={closeButtonRef} onClick={closeViewer}>Close</button>
              </div>
            </div>
            <div className="photoViewerCanvas">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt} />
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
