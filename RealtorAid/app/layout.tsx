import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Realtor Aid v1",
  description: "Lead ops cockpit for Realtors",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div>
              <p className="eyebrow">Realtor Aid</p>
              <h1>Lead Ops v1</h1>
              <p className="muted">Minimal CRM flow for active lead follow-up.</p>
            </div>
            <nav className="nav">
              <Link href="/">Dashboard</Link>
              <Link href="/leads">Leads</Link>
              <Link href="/leads/new">Quick Add</Link>
            </nav>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
