import { Lead } from "@/lib/types";

const now = new Date("2026-04-01T13:00:00-07:00");

function iso(offsetDays: number, hour = 9) {
  const d = new Date(now);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export const seedLeads: Lead[] = [
  {
    id: "lead-1",
    name: "Sarah Mitchell",
    email: "sarah@example.com",
    phone: "(602) 555-0182",
    stage: "new",
    source: "Zillow",
    location: "Scottsdale",
    budget: "$700k-$850k",
    tags: ["buyer", "hot"],
    notes: "First-time luxury buyer. Wants gated community and modern kitchen.",
    createdAt: iso(-1, 10),
    lastContactAt: iso(-1, 11),
    nextFollowUpAt: iso(0, 15),
    activities: [
      { id: "a-1", type: "email", summary: "Responded to website inquiry and shared 3 listings.", occurredAt: iso(-1, 11) },
    ],
  },
  {
    id: "lead-2",
    name: "Miguel Alvarez",
    email: "miguel@example.com",
    phone: "(480) 555-0134",
    stage: "active",
    source: "Open House",
    location: "Tempe",
    budget: "$450k-$550k",
    tags: ["buyer", "investor"],
    notes: "Looking for duplex potential. Very responsive by text.",
    createdAt: iso(-6, 12),
    lastContactAt: iso(-2, 16),
    nextFollowUpAt: iso(-1, 14),
    activities: [
      { id: "a-2", type: "meeting", summary: "Met at open house and captured financing status.", occurredAt: iso(-6, 12) },
      { id: "a-3", type: "text", summary: "Sent cap-rate comps and zoning notes.", occurredAt: iso(-2, 16) },
    ],
  },
  {
    id: "lead-3",
    name: "Priya Shah",
    email: "priya@example.com",
    phone: "(623) 555-0191",
    stage: "nurture",
    source: "Referral",
    location: "Phoenix",
    budget: "$900k+",
    tags: ["seller"],
    notes: "Potential listing in Arcadia. Wants timing advice before summer.",
    createdAt: iso(-18, 9),
    lastContactAt: iso(-8, 10),
    nextFollowUpAt: null,
    activities: [
      { id: "a-4", type: "call", summary: "Discussed pre-listing repairs and timing tradeoffs.", occurredAt: iso(-8, 10) },
    ],
  },
  {
    id: "lead-4",
    name: "Derrick Coleman",
    email: "derrick@example.com",
    phone: "(602) 555-0149",
    stage: "active",
    source: "Instagram Ad",
    location: "Mesa",
    budget: "$350k-$450k",
    tags: ["buyer"],
    notes: "Needs lender intro. Wants low HOA and fast close.",
    createdAt: iso(-3, 8),
    lastContactAt: iso(0, 8),
    nextFollowUpAt: iso(1, 10),
    activities: [
      { id: "a-5", type: "call", summary: "Qualified timeline and sent lender intro.", occurredAt: iso(0, 8) },
    ],
  },
];
