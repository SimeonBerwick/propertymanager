import { AppShell } from '@/components/app-shell';
import { ErrorBanner, Field, Input } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { login } from './actions';

const loginCards = [
  {
    role: 'operator',
    title: 'Operator sign in',
    description: 'Full maintenance command access with operator-only routes and actions.',
    email: 'olivia@example.com',
    password: 'operator123',
    button: 'Sign in as operator',
  },
  {
    role: 'tenant',
    title: 'Tenant sign in',
    description: 'Submit and review only requests tied to the signed-in tenant record.',
    email: 'tina@example.com',
    password: 'tenant123',
    button: 'Sign in as tenant',
  },
  {
    role: 'vendor',
    title: 'Vendor sign in',
    description: 'See only vendor-visible work assigned to the signed-in company.',
    email: 'dispatch@aceplumbing.test',
    password: 'vendor123',
    button: 'Sign in as vendor',
  },
] as const;

export default async function AuthPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageSection
          title="Sign in"
          description="Property Manager now uses credential-based sign-in backed by seeded account records and signed sessions instead of a pure role picker."
        >
          <ErrorBanner message={resolvedSearchParams?.error} />
          <div className="grid gap-6 lg:grid-cols-3">
            {loginCards.map((card) => (
              <form key={card.role} action={login} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                <input type="hidden" name="role" value={card.role} />
                <div>
                  <p className="font-medium text-slate-900">{card.title}</p>
                  <p className="text-sm text-slate-600">{card.description}</p>
                </div>
                <Field label="Email">
                  <Input name="email" type="email" defaultValue={card.email} required />
                </Field>
                <Field label="Password">
                  <Input name="password" type="password" defaultValue={card.password} required />
                </Field>
                <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">{card.button}</button>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Seeded demo creds: <strong>{card.email}</strong> / <strong>{card.password}</strong>
                </div>
              </form>
            ))}
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
