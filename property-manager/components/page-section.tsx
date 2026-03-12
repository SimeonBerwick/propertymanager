import { ReactNode } from 'react';

export function PageSection({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}
