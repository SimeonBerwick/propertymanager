import { Lead } from "@/lib/types";

export type LeadExecutionState =
  | "overdue"
  | "due"
  | "unscheduled"
  | "stale"
  | "new"
  | "active"
  | "nurture"
  | "under-contract"
  | "closed";

export function getLeadExecutionState(lead: Lead, now = new Date()): LeadExecutionState {
  if (lead.stage === "closed") return "closed";
  if (!lead.nextFollowUpAt) return "unscheduled";

  const next = new Date(lead.nextFollowUpAt);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (next < start) return "overdue";

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (next < end) return "due";

  const staleBoundary = new Date(start);
  staleBoundary.setDate(staleBoundary.getDate() - 7);
  if (new Date(lead.lastContactAt) < staleBoundary) return "stale";

  return lead.stage;
}

export function getLeadAgeDays(lead: Lead, now = new Date()) {
  const diff = now.getTime() - new Date(lead.createdAt).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function getLastTouchDays(lead: Lead, now = new Date()) {
  const diff = now.getTime() - new Date(lead.lastContactAt).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function getPrimaryTaskId(lead: Lead) {
  return lead.followUpTasks.find((task) => task.status === "pending")?.id ?? null;
}
