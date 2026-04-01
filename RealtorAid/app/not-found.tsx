import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <div className="card stack">
        <h2>Lead not found</h2>
        <p className="muted">That record does not exist in the in-memory demo store.</p>
        <Link href="/leads"><button>Back to leads</button></Link>
      </div>
    </div>
  );
}
