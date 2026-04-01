export type LeadStatus = "new" | "active" | "nurture" | "under-contract" | "closed";

export type ActivityType =
  | "call"
  | "text"
  | "email"
  | "note"
  | "showing"
  | "meeting";

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
  status: "pending" | "completed" | "canceled";
  completedAt: string | null;
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
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  lastContactAt: string;
  nextFollowUpAt: string | null;
  activities: Activity[];
  followUpTasks: FollowUpTask[];
}

export interface DashboardQueues {
  newLeads: Lead[];
  dueToday: Lead[];
  overdue: Lead[];
  stale: Lead[];
}
