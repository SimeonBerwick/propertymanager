"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addActivity, addLead, scheduleFollowUp, updateLeadStage } from "@/lib/store";
import { ActivityType, LeadStatus } from "@/lib/types";

export async function createLead(_state: { error?: string }, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const source = String(formData.get("source") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const budget = String(formData.get("budget") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const tags = String(formData.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean);

  if (!name || !email || !phone || !source || !location || !budget) {
    return { error: "Missing required fields." };
  }

  const lead = addLead({ name, email, phone, source, location, budget, tags, notes });
  revalidatePath("/");
  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function createActivity(leadId: string, _state: { error?: string }, formData: FormData) {
  const type = String(formData.get("type") || "call") as ActivityType;
  const summary = String(formData.get("summary") || "").trim();
  if (!summary) return { error: "Activity summary is required." };
  const lead = addActivity(leadId, { type, summary });
  if (!lead) return { error: "Lead not found." };
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return {};
}

export async function setFollowUp(leadId: string, _state: { error?: string }, formData: FormData) {
  const nextFollowUpAt = String(formData.get("nextFollowUpAt") || "");
  if (!nextFollowUpAt) return { error: "Follow-up time is required." };
  const lead = scheduleFollowUp(leadId, new Date(nextFollowUpAt).toISOString());
  if (!lead) return { error: "Lead not found." };
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return {};
}

export async function setLeadStage(leadId: string, formData: FormData) {
  const stage = String(formData.get("stage") || "new") as LeadStatus;
  updateLeadStage(leadId, stage);
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}
