import Link from 'next/link'

export function AuthNavigationLinks({ showRoleChoice = true }: { showRoleChoice?: boolean }) {
  return (
    <nav className="authNavigationLinks" aria-label="Sign-in navigation">
      <Link href="/" className="button">Home</Link>
      {showRoleChoice ? (
        <Link href="/login?role=choose" className="button">Choose another role</Link>
      ) : null}
    </nav>
  )
}
