import { prisma } from "@/lib/db";
import { seedLeadInputs, seedOrganization, seedUser } from "@/lib/seed";
import { ActivityType, DashboardQueues, Lead, LeadStatus } from "@/lib/types";
import { startOfDay } from "@/lib/utils";

const DEFAULT_ORG_SLUG = seedOrganization.slug;

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

function mapLead(lead: any): Lead {
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
    tags: lead.tags,
    notes: lead.notes,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    lastContactAt: lead.lastContactAt.toISOString(),
    nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
    activities: lead.activities
      .slice()
      .sort((a: any, b: any) => +b.occurredAt - +a.occurredAt)
      .map((activity: any) => ({
        id: activity.id,
        type: activity.type as ActivityType,
        summary: activity.summary,
        occurredAt: activity.occurredAt.toISOString(),
      })),
    followUpTasks: lead.followUpTasks
      .slice()
      .sort((a: any, b: any) => +a.dueAt - +b.dueAt)
      .map((task: any) => ({
        id: task.id,
        title: task.title,
        dueAt: task.dueAt.toISOString(),
        status: task.status,
        completedAt: task.completedAt?.toISOString() ?? null,
      })),
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

  const owner = organization.users[0] ?? (await prisma.user.findFirstOrThrow({ where: { organizationId: organization.id } }));
  return { organization, owner };
}

export async function ensureSeedData() {
  const { organization, owner } = await getDefaultContext();
  const existingCount = await prisma.lead.count({ where: { organizationId: organization.id } });
  if (existingCount > 0) return;

  for (const lead of seedLeadInputs) {
    await prisma.lead.create({
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
        tags: lead.tags,
        notes: lead.notes,
        createdAt: new Date(lead.createdAt),
        updatedAt: new Date(lead.createdAt),
        lastContactAt: new Date(lead.lastContactAt),
        nextFollowUpAt: lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null,
        activities: {
          create: lead.activities.map((activity) => ({
            userId: owner.id,
            type: activity.type,
            summary: activity.summary,
            occurredAt: new Date(activity.occurredAt),
            createdAt: new Date(activity.occurredAt),
          })),
        },
        followUpTasks: lead.nextFollowUpAt
          ? {
              create: {
                userId: owner.id,
                title: `Follow up with ${lead.name}`,
                dueAt: new Date(lead.nextFollowUpAt),
              },
            }
          : undefined,
      },
    });
  }
}

async function getLeadRecords() {
  await ensureSeedData();
  const { organization } = await getDefaultContext();

  return prisma.lead.findMany({
    where: { organizationId: organization.id },
    include: {
      owner: true,
      activities: true,
      followUpTasks: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listLeads() {
  const leads = await getLeadRecords();
  return leads.map(mapLead);
}

export async function getLead(id: string) {
  await ensureSeedData();
  const { organization } = await getDefaultContext();
  const lead = await prisma.lead.findFirst({
    where: { id, organizationId: organization.id },
    include: {
      owner: true,
      activities: true,
      followUpTasks: true,
    },
  });

  return lead ? mapLead(lead) : null;
}

export async function addLead(input: {
  name: string;
  email: string;
  phone: string;
  source: string;
  location: string;
  budget: string;
  tags: string[];
  notes: string;
}) {
  const { organization, owner } = await getDefaultContext();
  const now = new Date();

  const lead = await prisma.lead.create({
    data: {
      organizationId: organization.id,
      ownerUserId: owner.id,
      name: input.name,
      email: input.email,
      phone: input.phone,
      source: input.source,
      location: input.location,
      budget: input.budget,
      tags: input.tags,
      notes: input.notes,
      lastContactAt: now,
      activities: {
        create: {
          userId: owner.id,
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

export async function addActivity(leadId: string, input: { type: ActivityType; summary: string; occurredAt?: string }) {
  const lead = await getLead(leadId);
  if (!lead) return null;

  const when = input.occurredAt ? new Date(input.occurredAt) : new Date();
  const activity = await prisma.activity.create({
    data: {
      leadId,
      userId: lead.ownerUserId ?? undefined,
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

export async function scheduleFollowUp(leadId: string, nextFollowUpAt: string) {
  const lead = await getLead(leadId);
  if (!lead) return null;

  const dueAt = new Date(nextFollowUpAt);
  await prisma.lead.update({
    where: { id: leadId },
    data: { nextFollowUpAt: dueAt },
  });

  const existingTask = await prisma.followUpTask.findFirst({
    where: { leadId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  if (existingTask) {
    await prisma.followUpTask.update({
      where: { id: existingTask.id },
      data: {
        dueAt,
        title: `Follow up with ${lead.name}`,
      },
    });
  } else {
    await prisma.followUpTask.create({
      data: {
        leadId,
        userId: lead.ownerUserId ?? undefined,
        title: `Follow up with ${lead.name}`,
        dueAt,
      },
    });
  }

  return getLead(leadId);
}

export async function updateLeadStage(leadId: string, stage: LeadStatus) {
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      stage: appStageToDb(stage),
    },
  });

  return getLead(leadId);
}

export async function getDashboardQueues(now = new Date()): Promise<DashboardQueues> {
  const leads = await listLeads();
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
