import Link from 'next/link'
import { getProperties } from '@/lib/data'
import { units } from '@/lib/seed-data'

export default async function PropertiesPage() {
  const properties = await getProperties()

  return (
    <div className="grid cols-2">
      {properties.map((property) => {
        const propertyUnits = units.filter((unit) => unit.propertyId === property.id)
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
              <ul>
                {propertyUnits.map((unit) => (
                  <li key={unit.id}>{unit.label}{unit.tenantName ? ` — ${unit.tenantName}` : ''}</li>
                ))}
              </ul>
            </div>
          </section>
        )
      })}
    </div>
  )
}
