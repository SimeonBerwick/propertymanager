import Link from 'next/link'
import type { Route } from 'next'

export function BrandLogo({ href = '/' }: { href?: Route }) {
  return (
    <Link href={href} className="brandLogo" aria-label="Simeonware home">
      <svg viewBox="0 0 330 54" role="img" aria-labelledby="simeonware-logo-title">
        <title id="simeonware-logo-title">Simeonware</title>
        <text x="4" y="38" className="brandLogoText">SIMEONWARE</text>
        <path className="brandLogoArrow" d="M18 27H282" />
        <path className="brandLogoArrowHead" d="m280 18 20 9-20 9" />
      </svg>
    </Link>
  )
}
