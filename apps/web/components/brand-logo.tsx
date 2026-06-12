import Link from 'next/link'
import type { Route } from 'next'

export function BrandLogo({ href = '/' }: { href?: Route }) {
  return (
    <Link href={href} className="brandLogo" aria-label="Simeonware home">
      <svg viewBox="0 0 350 62" role="img" aria-labelledby="simeonware-logo-title">
        <title id="simeonware-logo-title">Simeonware</title>
        <text x="4" y="46" className="brandLogoText">SIMEONWARE</text>
        <path className="brandLogoArrow" d="M218 37H319" />
        <path className="brandLogoArrowHead" d="m315 27 27 10-27 10z" />
      </svg>
    </Link>
  )
}
