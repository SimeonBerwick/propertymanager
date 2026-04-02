import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string; callbackUrl?: string };
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  const error = searchParams?.error ? "Invalid email or password." : "";

  return (
    <div className="loginShell">
      <form
        className="card loginCard"
        action={async (formData) => {
          "use server";
          await signIn("credentials", {
            email: String(formData.get("email") || ""),
            password: String(formData.get("password") || ""),
            redirectTo: String(formData.get("callbackUrl") || "/"),
          });
        }}
      >
        <div>
          <p className="eyebrow">Realtor Aid v2</p>
          <h1>Sign in</h1>
          <p className="muted">Org-scoped access. No anonymous CRM access.</p>
        </div>
        <input type="hidden" name="callbackUrl" value={searchParams?.callbackUrl || "/"} />
        <input name="email" type="email" placeholder="Email" defaultValue="owner@realtoraid.local" required />
        <input name="password" type="password" placeholder="Password" required />
        {error ? <div className="badge overdue">{error}</div> : null}
        <button type="submit">Sign in</button>
        <div className="muted" style={{ fontSize: 14 }}>
          Demo bootstrap: owner@realtoraid.local / change-me-now
        </div>
      </form>
    </div>
  );
}
