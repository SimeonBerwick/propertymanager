import { submitOtp } from './actions';

interface Props {
  searchParams: Promise<{
    challengeId?: string;
    inviteId?: string;
    error?: string;
    channel?: string;
    masked?: string;
    delivery?: string;
    _devCode?: string;
  }>;
}

export default async function OtpPage({ searchParams }: Props) {
  const { challengeId, inviteId, error, channel, masked, delivery, _devCode } = await searchParams;

  if (!challengeId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-red-600">Invalid or missing verification session. Please start from your invite link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-900">Enter your code</h1>
          <p className="text-sm text-slate-600">
            {delivery === 'sms-sent' && masked ? `We sent a 6-digit verification code by text message to ${masked}. Enter it below to continue.` : null}
            {delivery === 'email-sent' && masked ? `We sent a 6-digit verification code by email to ${masked}. Enter it below to continue.` : null}
            {delivery === 'sms-dev' && masked ? `A text-message verification flow was generated for ${masked}. Enter the 6-digit code below to continue.` : null}
            {delivery === 'email-dev' && masked ? `An email verification flow was generated for ${masked}. Enter the 6-digit code below to continue.` : null}
            {!delivery ? 'Enter the 6-digit verification code below to continue.' : null}
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {_devCode && process.env.NODE_ENV !== 'production' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-medium">Dev mode:</span> live delivery is not confirmed here. Use code <span className="font-mono font-bold">{_devCode}</span> to continue.
          </div>
        )}

        <form action={submitOtp} className="space-y-4">
          <input type="hidden" name="challengeId" value={challengeId} />
          {inviteId && <input type="hidden" name="inviteId" value={inviteId} />}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700" htmlFor="code">
              Verification code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              required
              className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-center text-2xl font-mono tracking-widest text-slate-900 placeholder:text-slate-300 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Verify
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          Did not receive a code? Contact your property manager.
        </p>
      </div>
    </div>
  );
}
