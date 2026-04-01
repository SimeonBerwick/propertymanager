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

export interface Lead {
  id: string;
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
  lastContactAt: string;
  nextFollowUpAt: string | null;
  activities: Activity[];
}
