interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function MobileAuthLandingPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Tenant Portal</p>
          <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
          <p className="text-sm text-slate-600">
            Use the invite link sent by your property manager to access your account.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Check your text messages or email for a sign-in link from your property manager.
        </div>
      </div>
    </div>
  );
}
