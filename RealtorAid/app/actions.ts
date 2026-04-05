"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addActivity,
  addLead,
  assignLeadOwner,
  cancelFollowUpTask,
  completeFollowUpTask,
  scheduleFollowUp,
  updateFollowUpTask,
  updateLeadStage,
} from "@/lib/store";
import { requireUser } from "@/lib/auth";
import { ActivityType, CurrencyOption, LanguageOption, LeadStatus } from "@/lib/types";

export async function createLead(_state: { error?: string }, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const source = String(formData.get("source") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const budget = String(formData.get("budget") || "").trim();
  const currency = String(formData.get("currency") || "usd").trim() as CurrencyOption;
  const language = String(formData.get("language") || "english").trim() as LanguageOption;
  const notes = String(formData.get("notes") || "").trim();
  const tags = String(formData.get("tags") || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (!name || !email || !phone || !source || !location || !budget) {
    return { error: "Missing required fields." };
  }

  const user = await requireUser();
  const lead = await addLead(
    { userId: user.id, organizationId: user.organizationId },
    { name, email, phone, source, location, budget, currency, language, tags, notes },
  );
  revalidatePath("/");
  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function createActivity(leadId: string, _state: { error?: string }, formData: FormData) {
  const type = String(formData.get("type") || "call") as ActivityType;
  const summary = String(formData.get("summary") || "").trim();
  if (!summary) return { error: "Activity summary is required." };
  const user = await requireUser();
  const lead = await addActivity(leadId, { userId: user.id, organizationId: user.organizationId }, { type, summary });
  if (!lead) return { error: "Lead not found." };
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return {};
}

function parseFollowUpForm(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const nextFollowUpAt = String(formData.get("nextFollowUpAt") || "");
  const notes = String(formData.get("notes") || "").trim();

  if (!title) return { error: "Follow-up title is required." };
  if (!nextFollowUpAt) return { error: "Follow-up time is required." };

  return {
    title,
    dueAt: new Date(nextFollowUpAt).toISOString(),
    notes,
  };
}

export async function setFollowUp(leadId: string, _state: { error?: string }, formData: FormData) {
  const parsed = parseFollowUpForm(formData);
  if ("error" in parsed) return parsed;

  const user = await requireUser();

  try {
    const lead = await scheduleFollowUp(leadId, { userId: user.id, organizationId: user.organizationId }, parsed);
    if (!lead) return { error: "Lead not found." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to schedule follow-up." };
  }

  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return {};
}

export async function updateExistingFollowUp(
  leadId: string,
  taskId: string,
  _state: { error?: string },
  formData: FormData,
) {
  const parsed = parseFollowUpForm(formData);
  if ("error" in parsed) return parsed;

  const user = await requireUser();

  try {
    const lead = await updateFollowUpTask(
      leadId,
      taskId,
      { userId: user.id, organizationId: user.organizationId },
      parsed,
    );
    if (!lead) return { error: "Open follow-up not found." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update follow-up." };
  }

  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return {};
}

export async function completeFollowUp(leadId: string, taskId: string) {
  const user = await requireUser();
  const lead = await completeFollowUpTask(leadId, taskId, {
    userId: user.id,
    organizationId: user.organizationId,
  });

  if (!lead) return { error: "Open follow-up not found." };

  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return {};
}

export async function cancelFollowUp(leadId: string, taskId: string) {
  const user = await requireUser();
  const lead = await cancelFollowUpTask(leadId, taskId, {
    userId: user.id,
    organizationId: user.organizationId,
  });

  if (!lead) return { error: "Open follow-up not found." };

  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return {};
}

export async function setLeadStage(leadId: string, formData: FormData) {
  const stage = String(formData.get("stage") || "new") as LeadStatus;
  const user = await requireUser();
  await updateLeadStage(leadId, { userId: user.id, organizationId: user.organizationId }, stage);
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function setLeadOwner(leadId: string, formData: FormData) {
  const ownerUserIdValue = String(formData.get("ownerUserId") || "").trim();
  const ownerUserId = ownerUserIdValue || null;
  const user = await requireUser();
  const lead = await assignLeadOwner(leadId, { userId: user.id, organizationId: user.organizationId }, ownerUserId);
  if (!lead) return { error: "Unable to assign owner." };
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return {};
}
