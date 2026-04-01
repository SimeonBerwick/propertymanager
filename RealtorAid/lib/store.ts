import { seedLeads } from "@/lib/seed";
import { Activity, ActivityType, Lead, LeadStatus } from "@/lib/types";
import { startOfDay } from "@/lib/utils";

const globalForStore = globalThis as typeof globalThis & {
  __realtorAidStore?: { leads: Lead[] };
};

function getState() {
  if (!globalForStore.__realtorAidStore) {
    globalForStore.__realtorAidStore = { leads: structuredClone(seedLeads) };
  }
  return globalForStore.__realtorAidStore;
}

export function listLeads() {
  return getState().leads
    .slice()
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function getLead(id: string) {
  return getState().leads.find((lead) => lead.id === id) ?? null;
}

export function addLead(input: {
  name: string;
  email: string;
  phone: string;
  source: string;
  location: string;
  budget: string;
  tags: string[];
  notes: string;
}): Lead {
  const now = new Date().toISOString();
  const lead: Lead = {
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email,
    phone: input.phone,
    source: input.source,
    location: input.location,
    budget: input.budget,
    tags: input.tags,
    notes: input.notes,
    stage: "new",
    createdAt: now,
    lastContactAt: now,
    nextFollowUpAt: null,
    activities: [
      {
        id: crypto.randomUUID(),
        type: "note",
        summary: "Lead created.",
        occurredAt: now,
      },
    ],
  };

  getState().leads.unshift(lead);
  return lead;
}

export function addActivity(leadId: string, input: { type: ActivityType; summary: string; occurredAt?: string }) {
  const lead = getLead(leadId);
  if (!lead) return null;

  const activity: Activity = {
    id: crypto.randomUUID(),
    type: input.type,
    summary: input.summary,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };

  lead.activities.unshift(activity);
  lead.lastContactAt = activity.occurredAt;
  if (lead.stage === "new") lead.stage = "active";
  return lead;
}

export function scheduleFollowUp(leadId: string, nextFollowUpAt: string) {
  const lead = getLead(leadId);
  if (!lead) return null;
  lead.nextFollowUpAt = nextFollowUpAt;
  return lead;
}

export function updateLeadStage(leadId: string, stage: LeadStatus) {
  const lead = getLead(leadId);
  if (!lead) return null;
  lead.stage = stage;
  return lead;
}

export function getDashboardQueues(now = new Date()) {
  const leads = listLeads();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const staleBoundary = new Date(today);
  staleBoundary.setDate(today.getDate() - 7);

  return {
    newLeads: leads.filter((lead) => lead.stage === "new"),
    dueToday: leads.filter((lead) => {
      if (!lead.nextFollowUpAt) return false;
      const date = new Date(lead.nextFollowUpAt);
      return date >= today && date < tomorrow;
    }),
    overdue: leads.filter((lead) => {
      if (!lead.nextFollowUpAt) return false;
      return new Date(lead.nextFollowUpAt) < today;
    }),
    stale: leads.filter((lead) => new Date(lead.lastContactAt) < staleBoundary),
  };
}
