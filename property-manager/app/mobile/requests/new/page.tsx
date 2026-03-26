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
    <div className="space-y-6">
      <div>
        <Link href={'/mobile' as Route} className="text-xs text-slate-500 hover:text-slate-700">
          &larr; Back
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">Report an issue</h2>
      </div>

      <form action={submitMobileRequest} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="title">
            What&apos;s wrong? <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="e.g. Leaking kitchen faucet"
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="description">
            Describe the problem <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={4}
            placeholder="Include when it started, how often it happens, and any relevant details..."
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="category">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            name="category"
            required
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-300"
          >
            <option value="">Select category</option>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="urgency">
            Urgency <span className="text-red-500">*</span>
          </label>
          <select
            id="urgency"
            name="urgency"
            required
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-300"
          >
            <option value="">Select urgency</option>
            {Object.entries(urgencyLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="contactPhone">
            Best callback number <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            placeholder="555-0100"
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="entryNotes">
            Entry notes <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="entryNotes"
            name="entryNotes"
            type="text"
            placeholder="e.g. OK to enter any time, dog in unit"
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
        >
          Submit request
        </button>
      </form>
    </div>
  );
}
