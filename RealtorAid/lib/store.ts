import { prisma } from "@/lib/db";
import { seedLeadInputs, seedOrganization, seedUser } from "@/lib/seed";
import {
  ActivityType,
  CurrencyOption,
  DashboardQueues,
  LanguageOption,
  Lead,
  LeadStatus,
  FollowUpTaskInput,
  FollowUpTaskStatus,
  TeamUser,
} from "@/lib/types";
import { startOfDay } from "@/lib/utils";

export type AuthContext = {
  userId: string;
  organizationId: string;
};

const DEFAULT_ORG_SLUG = seedOrganization.slug;
const CLOSED_STAGES: LeadStatus[] = ["closed"];

type LeadRecord = Awaited<ReturnType<typeof prisma.lead.findFirstOrThrow>> & {
  owner: { name: string } | null;
  activities: any[];
  followUpTasks: any[];
};

function dbStageToApp(stage: string): LeadStatus {
  switch (stage) {
    case "under_contract":
      return "under-contract";
    default:
      return stage as LeadStatus;
  }
}

function appStageToDb(stage: LeadStatus) {
  return stage === "under-contract" ? "under_contract" : stage;
}

function isClosedStage(stage: LeadStatus) {
  return CLOSED_STAGES.includes(stage);
}

function getPrimaryOpenTask(tasks: Array<{ dueAt: Date; status: FollowUpTaskStatus }>) {
  return tasks
    .filter((task) => task.status === "pending")
    .sort((a, b) => +a.dueAt - +b.dueAt)[0] ?? null;
}

function mapLead(lead: any): Lead {
  const followUpTasks = lead.followUpTasks
    .slice()
    .sort((a: any, b: any) => {
      const aPending = a.status === "pending" ? 0 : 1;
      const bPending = b.status === "pending" ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return +a.dueAt - +b.dueAt;
    })
    .map((task: any) => ({
      id: task.id,
      title: task.title,
      dueAt: task.dueAt.toISOString(),
      status: task.status,
      completedAt: task.completedAt?.toISOString() ?? null,
      notes: task.notes ?? "",
    }));

  const primaryOpenTask = getPrimaryOpenTask(lead.followUpTasks);

  return {
    id: lead.id,
    organizationId: lead.organizationId,
    ownerUserId: lead.ownerUserId ?? null,
    ownerName: lead.owner?.name ?? null,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    stage: dbStageToApp(lead.stage),
    source: lead.source,
    location: lead.location,
    budget: lead.budget,
    currency: lead.currency,
    language: lead.language,
    tags: lead.tags,
    notes: lead.notes,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    lastContactAt: lead.lastContactAt.toISOString(),
    nextFollowUpAt: primaryOpenTask?.dueAt.toISOString() ?? null,
    activities: lead.activities
      .slice()
      .sort((a: any, b: any) => +b.occurredAt - +a.occurredAt)
      .map((activity: any) => ({
        id: activity.id,
        type: activity.type as ActivityType,
        summary: activity.summary,
        occurredAt: activity.occurredAt.toISOString(),
      })),
    followUpTasks,
  };
}

async function getDefaultContext() {
  const organization = await prisma.organization.upsert({
    where: { slug: DEFAULT_ORG_SLUG },
    update: {},
    create: {
      name: seedOrganization.name,
      slug: seedOrganization.slug,
      users: {
        create: {
          email: seedUser.email,
          name: seedUser.name,
          role: seedUser.role,
        },
      },
    },
    include: { users: true },
  });

  const owner =
    organization.users[0] ??
    (await prisma.user.findFirstOrThrow({ where: { organizationId: organization.id } }));
  return { organization, owner };
}

async function syncLeadFollowUpState(leadId: string) {
  const nextTask = await prisma.followUpTask.findFirst({
    where: { leadId, status: "pending" },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      nextFollowUpAt: nextTask?.dueAt ?? null,
    },
  });
}

async function getLeadRecordOrThrow(leadId: string, context: AuthContext) {
  await ensureSeedData();
  return prisma.lead.findFirstOrThrow({
    where: { id: leadId, organizationId: context.organizationId },
    include: {
      owner: true,
      activities: true,
      followUpTasks: true,
    },
  });
}

export async function ensureSeedData() {
  const { organization, owner } = await getDefaultContext();
  const existingCount = await prisma.lead.count({ where: { organizationId: organization.id } });
  if (existingCount > 0) return;

  for (const lead of seedLeadInputs) {
    const createdLead = await prisma.lead.create({
      data: {
        organizationId: organization.id,
        ownerUserId: owner.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        stage: appStageToDb(lead.stage),
        source: lead.source,
        location: lead.location,
        budget: lead.budget,
        currency: lead.currency,
        language: lead.language,
        tags: lead.tags,
        notes: lead.notes,
        createdAt: new Date(lead.createdAt),
        updatedAt: new Date(lead.createdAt),
        lastContactAt: new Date(lead.lastContactAt),
        nextFollowUpAt: null,
        activities: {
          create: lead.activities.map((activity) => ({
            userId: owner.id,
            type: activity.type,
            summary: activity.summary,
            occurredAt: new Date(activity.occurredAt),
            createdAt: new Date(activity.occurredAt),
          })),
        },
      },
    });

    if (lead.nextFollowUpAt) {
      await prisma.followUpTask.create({
        data: {
          leadId: createdLead.id,
          userId: owner.id,
          title: `Follow up with ${lead.name}`,
          dueAt: new Date(lead.nextFollowUpAt),
          notes: "",
        },
      });
      await syncLeadFollowUpState(createdLead.id);
    }
  }
}

async function getLeadRecords(context: AuthContext) {
  await ensureSeedData();

  return prisma.lead.findMany({
    where: { organizationId: context.organizationId },
    include: {
      owner: true,
      activities: true,
      followUpTasks: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listLeads(context: AuthContext) {
  const leads = await getLeadRecords(context);
  return leads.map(mapLead);
}

export async function getLead(id: string, context: AuthContext) {
  await ensureSeedData();
  const lead = await prisma.lead.findFirst({
    where: { id, organizationId: context.organizationId },
    include: {
      owner: true,
      activities: true,
      followUpTasks: true,
    },
  });

  return lead ? mapLead(lead) : null;
}

export async function addLead(
  context: AuthContext,
  input: {
    name: string;
    email: string;
    phone: string;
    source: string;
    location: string;
    budget: string;
    currency: CurrencyOption;
    language: LanguageOption;
    tags: string[];
    notes: string;
  },
) {
  const now = new Date();

  const lead = await prisma.lead.create({
    data: {
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      source: input.source,
      location: input.location,
      budget: input.budget,
      currency: input.currency,
      language: input.language,
      tags: input.tags,
      notes: input.notes,
      lastContactAt: now,
      activities: {
        create: {
          userId: context.userId,
          type: "note",
          summary: "Lead created.",
          occurredAt: now,
        },
      },
    },
    include: {
      owner: true,
      activities: true,
      followUpTasks: true,
    },
  });

  return mapLead(lead);
}

export async function addActivity(
  leadId: string,
  context: AuthContext,
  input: { type: ActivityType; summary: string; occurredAt?: string },
) {
  const lead = await getLead(leadId, context);
  if (!lead) return null;

  const when = input.occurredAt ? new Date(input.occurredAt) : new Date();
  const activity = await prisma.activity.create({
    data: {
      leadId,
      userId: context.userId,
      type: input.type,
      summary: input.summary,
      occurredAt: when,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      lastContactAt: when,
      stage: lead.stage === "new" ? "active" : appStageToDb(lead.stage),
    },
  });

  return activity;
}

export async function scheduleFollowUp(
  leadId: string,
  context: AuthContext,
  input: FollowUpTaskInput,
) {
  const lead = await getLead(leadId, context);
  if (!lead) return null;
  if (isClosedStage(lead.stage)) {
    throw new Error("Closed leads cannot receive new open follow-ups.");
  }

  await prisma.followUpTask.create({
    data: {
      leadId,
      userId: context.userId,
      title: input.title,
      dueAt: new Date(input.dueAt),
      notes: input.notes,
    },
  });

  await syncLeadFollowUpState(leadId);
  return getLead(leadId, context);
}

export async function updateFollowUpTask(
  leadId: string,
  taskId: string,
  context: AuthContext,
  input: FollowUpTaskInput,
) {
  const lead = await getLead(leadId, context);
  if (!lead) return null;
  if (isClosedStage(lead.stage)) {
    throw new Error("Closed leads cannot carry new open follow-ups.");
  }

  const task = await prisma.followUpTask.findFirst({
    where: {
      id: taskId,
      leadId,
      lead: { organizationId: context.organizationId },
    },
  });

  if (!task || task.status !== "pending") return null;

  await prisma.followUpTask.update({
    where: { id: taskId },
    data: {
      title: input.title,
      dueAt: new Date(input.dueAt),
      notes: input.notes,
    },
  });

  await syncLeadFollowUpState(leadId);
  return getLead(leadId, context);
}

export async function completeFollowUpTask(leadId: string, taskId: string, context: AuthContext) {
  const task = await prisma.followUpTask.findFirst({
    where: {
      id: taskId,
      leadId,
      status: "pending",
      lead: { organizationId: context.organizationId },
    },
  });

  if (!task) return null;

  await prisma.followUpTask.update({
    where: { id: taskId },
    data: {
      status: "completed",
      completedAt: new Date(),
    },
  });

  await syncLeadFollowUpState(leadId);
  return getLead(leadId, context);
}

export async function cancelFollowUpTask(leadId: string, taskId: string, context: AuthContext) {
  const task = await prisma.followUpTask.findFirst({
    where: {
      id: taskId,
      leadId,
      status: "pending",
      lead: { organizationId: context.organizationId },
    },
  });

  if (!task) return null;

  await prisma.followUpTask.update({
    where: { id: taskId },
    data: {
      status: "canceled",
      completedAt: null,
    },
  });

  await syncLeadFollowUpState(leadId);
  return getLead(leadId, context);
}

export async function updateLeadStage(leadId: string, context: AuthContext, stage: LeadStatus) {
  const existing = await getLead(leadId, context);
  if (!existing) return null;

  if (stage === "closed") {
    await prisma.followUpTask.updateMany({
      where: { leadId, status: "pending" },
      data: { status: "canceled", completedAt: null },
    });
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      stage: appStageToDb(stage),
    },
  });

  await syncLeadFollowUpState(leadId);
  return getLead(leadId, context);
}

export async function listTeamUsers(context: AuthContext): Promise<TeamUser[]> {
  const users = await prisma.user.findMany({
    where: { organizationId: context.organizationId },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  }));
}

export async function assignLeadOwner(leadId: string, context: AuthContext, ownerUserId: string | null) {
  const existing = await getLead(leadId, context);
  if (!existing) return null;

  if (ownerUserId) {
    const owner = await prisma.user.findFirst({
      where: { id: ownerUserId, organizationId: context.organizationId },
    });
    if (!owner) return null;
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { ownerUserId },
  });

  return getLead(leadId, context);
}

export async function getDashboardQueues(context: AuthContext, now = new Date()): Promise<DashboardQueues> {
  const leads = await listLeads(context);
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
