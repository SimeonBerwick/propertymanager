import Link from 'next/link';
import type { Route } from 'next';
import { RequestCategory, RequestUrgency } from '@prisma/client';
import { submitMobileRequest } from './actions';

const categoryLabels: Record<RequestCategory, string> = {
  PLUMBING: 'Plumbing',
  ELECTRICAL: 'Electrical',
  HVAC: 'HVAC',
  APPLIANCE: 'Appliance',
  GENERAL: 'General',
  OTHER: 'Other',
};

const urgencyLabels: Record<RequestUrgency, string> = {
  LOW: 'Low – not urgent',
  MEDIUM: 'Medium – affects daily use',
  HIGH: 'High – immediate attention needed',
  EMERGENCY: 'Emergency – safety risk',
};

export default function NewMobileRequestPage() {
  return (
    <div className="space-y-5 text-white">
      <div className="space-y-2">
        <Link href={'/mobile' as Route} className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
          &larr; Back to requests
        </Link>
        <h2 className="text-2xl font-semibold">Report an issue</h2>
        <p className="text-sm leading-6 text-slate-300">
          Give the property team enough detail to triage and schedule the right kind of help quickly.
        </p>
      </div>

      <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
        If there is fire, flooding, gas, or an immediate safety risk, contact emergency services first and then notify your property manager.
      </div>

      <form action={submitMobileRequest} className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200" htmlFor="title">
            What&apos;s wrong? <span className="text-red-400">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="e.g. Kitchen sink leaking under cabinet"
            className="block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200" htmlFor="description">
            Describe the problem <span className="text-red-400">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={5}
            placeholder="Include when it started, how often it happens, what you already tried, and anything the technician should know before arriving."
            className="block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200" htmlFor="category">
              Category <span className="text-red-400">*</span>
            </label>
            <select
              id="category"
              name="category"
              required
              className="block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
            >
              <option value="">Select category</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200" htmlFor="urgency">
              Urgency <span className="text-red-400">*</span>
            </label>
            <select
              id="urgency"
              name="urgency"
              required
              className="block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
            >
              <option value="">Select urgency</option>
              {Object.entries(urgencyLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200" htmlFor="contactPhone">
            Best callback number <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            placeholder="555-0100"
            className="block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200" htmlFor="entryNotes">
            Entry notes <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="entryNotes"
            name="entryNotes"
            type="text"
            placeholder="e.g. Dog in unit, call before entering"
            className="block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          Submit request
        </button>
      </form>
    </div>
  );
}
