export default function NotFound() {
  return (
    <div className="card">
      <div className="kicker">Not found</div>
      <h2>That record does not exist.</h2>
      <p className="muted">The route resolved, but the property or request ID was not found in the current data source.</p>
    </div>
  )
}
