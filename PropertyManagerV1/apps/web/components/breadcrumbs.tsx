import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={`${item.label}-${index}`} className="breadcrumbs-item">
            {item.href && !isLast ? (
              <Link href={item.href as never} className="breadcrumbs-link">
                {item.label}
              </Link>
            ) : (
              <span aria-current={isLast ? 'page' : undefined} className="breadcrumbs-current">
                {item.label}
              </span>
            )}
            {!isLast && <span className="breadcrumbs-separator">/</span>}
          </span>
        )
      })}
    </nav>
  )
}
