'use client'

import { useState } from 'react'

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

  return (
    <a
      href={failed ? undefined : href}
      target={failed ? undefined : '_blank'}
      rel={failed ? undefined : 'noreferrer'}
      className={`photo-card${failed ? ' is-unavailable' : ''}`}
      aria-disabled={failed}
    >
      {failed ? (
        <div className="photo-fallback">{unavailableLabel}</div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="photo-image" onError={() => setFailed(true)} />
      )}
    </a>
  )
}
