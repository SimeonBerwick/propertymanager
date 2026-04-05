import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { auth, signOut } from "@/auth";

export const metadata: Metadata = {
  title: "Realtor Aid v2",
  description: "Lead ops cockpit for Realtors",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;

  return (
    <html lang="en">
      <body>
        {user ? (
          <div className="shell">
            <aside className="sidebar">
              <div className="stack-lg">
                <div className="brandBlock">
                  <p className="eyebrow">Realtor Aid</p>
                  <h1>Lead command</h1>
                  <p className="muted">A tighter PM surface for lead execution, follow-up discipline, and pipeline visibility.</p>
                </div>

                <div className="card stack sidebarCard">
                  <div>
                    <strong>{user.name}</strong>
                    <div className="muted">{user.email}</div>
                  </div>
                  <div className="muted">{user.organizationName} · {user.role}</div>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/login" });
                    }}
                  >
                    <button type="submit" className="secondary">Sign out</button>
                  </form>
                </div>
              </div>

              <nav className="nav">
                <Link href="/">Dashboard</Link>
                <Link href="/leads">Pipeline</Link>
                <Link href="/leads/new">Capture lead</Link>
              </nav>

              <div className="sidebarFoot muted">
                Run the urgent queue first. Everything else is secondary.
              </div>
            </aside>
            <main className="content">{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
