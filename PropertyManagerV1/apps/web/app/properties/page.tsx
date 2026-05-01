import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAllUnits, getProperties } from '@/lib/data'
import { getLandlordSession } from '@/lib/landlord-session'

export default async function PropertiesPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login')
  const [properties, allUnits] = await Promise.all([
    getProperties(session.userId, undefined, true),
    getAllUnits(session.userId, undefined, true),
  ])

  if (!properties.length) {
    return (
      <div className="card stack" style={{ maxWidth: 480, margin: '48px auto 0' }}>
        <div className="kicker">Properties</div>
        <h2 style={{ margin: '4px 0 0' }}>No properties yet</h2>
        <p className="muted" style={{ margin: 0 }}>
          Add your first property to start tracking work.
        </p>
        <Link href="/properties/new" className="button primary" style={{ alignSelf: 'flex-start' }}>
          Add first property
        </Link>
      </div>
    )
  }

  const activeProperties = properties.filter((property) => property.isActive)
  const archivedProperties = properties.filter((property) => !property.isActive)

  return (
    <div className="stack">
      <div className="row">
        <div>
          <div className="kicker">Portfolio</div>
          <h2 style={{ margin: '4px 0 0' }}>Properties</h2>
        </div>
        <Link href="/properties/new" className="button primary">Add property</Link>
      </div>

      <section className="stack">
        <div className="row">
          <h3 style={{ margin: 0 }}>Active</h3>
          <div className="muted">{activeProperties.length} properties</div>
        </div>
        {activeProperties.length ? (
          <div className="grid cols-2">
            {activeProperties.map((property) => {
              const propertyUnits = allUnits.filter((unit) => unit.propertyId === property.id)
              return (
                <section key={property.id} className="card stack">
                  <div>
                    <div className="kicker">Property</div>
                    <Link href={`/properties/${property.id}`}>
                      <h2 style={{ margin: '4px 0' }}>{property.name}</h2>
                    </Link>
                    <div className="muted">{property.address}</div>
                  </div>
                  <div>
                    <strong>Units</strong>
                    {propertyUnits.length ? (
                      <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                        {propertyUnits.map((unit) => (
                          <li key={unit.id}>
                            <Link href={`/units/${unit.id}`}>{unit.label}</Link>
                            {!unit.isActive ? ' (archived)' : ''}
                            {unit.tenantName ? ` — ${unit.tenantName}` : ' — Vacant'}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted" style={{ margin: '8px 0 0' }}>No units on record.</p>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="card muted">No active properties.</div>
        )}
      </section>

      {archivedProperties.length > 0 && (
        <section className="stack">
          <div className="row">
            <h3 style={{ margin: 0 }}>Archived</h3>
            <div className="muted">{archivedProperties.length} properties</div>
          </div>
          <div className="grid cols-2">
            {archivedProperties.map((property) => {
              const propertyUnits = allUnits.filter((unit) => unit.propertyId === property.id)
              return (
                <section key={property.id} className="card stack archivedCard">
                  <div>
                    <div className="kicker">Property</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Link href={`/properties/${property.id}`}>
                        <h2 style={{ margin: '4px 0' }}>{property.name}</h2>
                      </Link>
                      <span className="archiveBadge">Archived</span>
                    </div>
                    <div className="muted">{property.address}</div>
                  </div>
                  <div>
                    <strong>Units</strong>
                    {propertyUnits.length ? (
                      <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                        {propertyUnits.map((unit) => (
                          <li key={unit.id}>
                            <Link href={`/units/${unit.id}`}>{unit.label}</Link>
                            {!unit.isActive ? ' (archived)' : ''}
                            {unit.tenantName ? ` — ${unit.tenantName}` : ' — Vacant'}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted" style={{ margin: '8px 0 0' }}>No units on record.</p>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
