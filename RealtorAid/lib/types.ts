export type LeadStatus = "new" | "active" | "nurture" | "under-contract" | "closed";

export type ActivityType =
  | "call"
  | "text"
  | "email"
  | "note"
  | "showing"
  | "meeting";

export type FollowUpTaskStatus = "pending" | "completed" | "canceled";

export type CurrencyOption = "usd" | "peso" | "pound" | "euro";

export type LanguageOption = "english" | "spanish" | "french";

export interface Activity {
  id: string;
  type: ActivityType;
  summary: string;
  occurredAt: string;
}

export interface FollowUpTask {
  id: string;
  title: string;
  dueAt: string;
  status: FollowUpTaskStatus;
  completedAt: string | null;
  notes: string;
}

export interface FollowUpTaskInput {
  title: string;
  dueAt: string;
  notes: string;
}

export interface Lead {
  id: string;
  organizationId: string;
  ownerUserId: string | null;
  ownerName: string | null;
  name: string;
  email: string;
  phone: string;
  stage: LeadStatus;
  source: string;
  location: string;
  budget: string;
  currency: CurrencyOption;
  language: LanguageOption;
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  lastContactAt: string;
  nextFollowUpAt: string | null;
  activities: Activity[];
  followUpTasks: FollowUpTask[];
}

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface DashboardQueues {
  newLeads: Lead[];
  dueToday: Lead[];
  overdue: Lead[];
  stale: Lead[];
}
