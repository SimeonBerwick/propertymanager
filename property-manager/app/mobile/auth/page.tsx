interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function MobileAuthLandingPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between px-5 py-8">
        <div className="space-y-10">
          <div className="space-y-4 pt-6">
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
              Property Manager V1
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-white">Tenant app access</h1>
              <p className="text-sm leading-6 text-slate-300">
                Securely view updates, submit maintenance requests, and track work on your home from one mobile-friendly place.
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">How access works</p>
              <h2 className="text-lg font-semibold text-white">Use your property manager invite</h2>
            </div>

            <ol className="space-y-3 text-sm text-slate-200">
              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                  1
                </span>
                <span>Open the sign-in link your property manager sent by text or email.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                  2
                </span>
                <span>Enter the one-time verification code when prompted.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                  3
                </span>
                <span>Once signed in, you can track requests and send new ones from your phone.</span>
              </li>
            </ol>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            If you do not have your access link anymore, contact your property manager and ask them to send a new mobile invite.
          </div>
        </div>

        <div className="space-y-3 pb-2 pt-8 text-xs leading-5 text-slate-400">
          <p>Your access link is unique to you and helps keep your account secure.</p>
          <p>Internal property-manager notes and vendor-private documents are never shown in the tenant app.</p>
        </div>
      </div>
    </div>
  );
}
