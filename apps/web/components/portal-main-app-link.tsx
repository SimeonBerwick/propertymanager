'use client'

export function PortalMainAppLink() {
  return (
    <a
      href="/"
      className="button"
      onClick={(event) => {
        event.preventDefault()
        window.location.replace('/')
      }}
    >
      Choose another sign-in
    </a>
  )
}
