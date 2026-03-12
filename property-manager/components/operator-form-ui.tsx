import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function FormActions({ cancelHref, submitLabel }: { cancelHref: string; submitLabel: string }) {
  return (
    <div className="flex flex-wrap gap-3 pt-2">
      <button className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white" type="submit">
        {submitLabel}
      </button>
      <a href={cancelHref} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:border-slate-400 hover:text-slate-900">
        Cancel
      </a>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm text-slate-700">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-md border border-slate-300 px-3 py-2 ${props.className ?? ''}`.trim()} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full rounded-md border border-slate-300 px-3 py-2 ${props.className ?? ''}`.trim()} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-md border border-slate-300 px-3 py-2 ${props.className ?? ''}`.trim()} />;
}

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>;
}

export function PageActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3">{children}</div>;
}

export function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white no-underline hover:text-white">
      {children}
    </a>
  );
}
