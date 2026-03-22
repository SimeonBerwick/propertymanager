import Link from 'next/link'
import { getAllUnits, getProperties } from '@/lib/data'

export default async function PropertiesPage() {
  const [properties, allUnits] = await Promise.all([getProperties(), getAllUnits()])

  if (!properties.length) {
    return (
      <div className="card stack" style={{ maxWidth: 480, margin: '48px auto 0' }}>
        <div className="kicker">Properties</div>
        <h2 style={{ margin: '4px 0 0' }}>No properties yet</h2>
        <p className="muted" style={{ margin: 0 }}>
          No properties have been added yet.
        </p>
        <Link href="/properties/new" className="button primary" style={{ alignSelf: 'flex-start' }}>
          Add first property
        </Link>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="row">
        <div />
        <Link href="/properties/new" className="button primary">Add property</Link>
      </div>
    <div className="grid cols-2">
      {properties.map((property) => {
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
    </div>
  )
}
