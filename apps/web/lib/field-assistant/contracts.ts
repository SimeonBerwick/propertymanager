/**
 * Stable, product-neutral vocabulary for field-service verticals.
 *
 * This module deliberately has no database, route, or property-management imports.
 * Vertical packs adapt their existing records to these contracts; the deterministic
 * core remains the authority for validation and side effects.
 */

export const FIELD_JOB_STATUSES = [
  "DRAFT",
  "OPEN",
  "SCHEDULED",
  "IN_PROGRESS",
  "AWAITING_REVIEW",
  "COMPLETED",
  "CANCELLED",
] as const;

export type FieldJobStatus = (typeof FIELD_JOB_STATUSES)[number];

export type FieldPartyRole =
  | "CUSTOMER"
  | "REQUESTER"
  | "COORDINATOR"
  | "TECHNICIAN"
  | "SERVICE_PROVIDER"
  | "REVIEWER";

export interface FieldCustomer {
  id: string;
  displayName: string;
}

export interface FieldSite {
  id: string;
  customerId: string;
  displayName: string;
  address?: string;
}

export interface FieldAsset {
  id: string;
  siteId: string;
  displayName: string;
  assetType?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
}

export interface FieldParty {
  id: string;
  role: FieldPartyRole;
  displayName: string;
}

export interface FieldEvidence {
  id: string;
  kind: "PHOTO" | "DOCUMENT" | "MEASUREMENT" | "NOTE";
  createdAt: Date;
  createdBy?: FieldParty;
  reference: string;
}

export interface FieldJob {
  id: string;
  verticalId: string;
  customer: FieldCustomer;
  site: FieldSite;
  asset?: FieldAsset;
  status: FieldJobStatus;
  title: string;
  description?: string;
  participants: FieldParty[];
  evidence: FieldEvidence[];
  fields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FieldRequirement {
  key: string;
  label: string;
  requiredWhen: FieldJobStatus[];
  evidenceKind?: FieldEvidence["kind"];
}

export type FieldCommand =
  | { type: "SET_FIELD"; key: string; value: unknown }
  | { type: "ATTACH_EVIDENCE"; evidenceId: string }
  | { type: "REQUEST_REVIEW" }
  | { type: "COMPLETE" };

export interface FieldValidationResult {
  accepted: boolean;
  missingRequirementKeys: string[];
  reasons: string[];
}

export interface FieldVerticalPack {
  id: string;
  displayName: string;
  requirements: FieldRequirement[];
  allowedTransitions: Readonly<Record<FieldJobStatus, FieldJobStatus[]>>;
}

export interface DeterministicFieldCore {
  validate(job: FieldJob, command: FieldCommand, pack: FieldVerticalPack): FieldValidationResult;
  apply(job: FieldJob, command: FieldCommand, pack: FieldVerticalPack): FieldJob;
}

export interface FieldAiProposal {
  proposedCommands: FieldCommand[];
  requestedClarificationKeys: string[];
  confidence: number;
  source: "GENERATIVE_MODEL" | "DECISION_MODEL" | "MANUAL";
}

export interface FieldAiInterpreterInput {
  job: FieldJob;
  pack: FieldVerticalPack;
  allowedCommands: FieldCommand["type"][];
  interactionText: string;
}

/**
 * An AI interpreter may propose commands, but it cannot persist them. Every proposal
 * must pass through DeterministicFieldCore before a record, invoice, notification,
 * or status changes.
 */
export interface FieldAiInterpreter {
  propose(input: FieldAiInterpreterInput): Promise<FieldAiProposal>;
}

export interface FieldDecisionInput {
  state: string;
  question: string;
  choices: readonly string[];
}

export interface FieldDecisionResult {
  choice: string;
  confidence: number;
}

/**
 * Optional decision-model interface for bounded routing and escalation judgments.
 * This is intentionally provider-neutral so Jev can be evaluated without lock-in.
 */
export interface FieldDecisionModel {
  decide(input: FieldDecisionInput): Promise<FieldDecisionResult>;
}
