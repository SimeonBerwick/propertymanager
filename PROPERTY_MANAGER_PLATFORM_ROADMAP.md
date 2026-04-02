# Property Manager Platform Roadmap

## Core product truth
Property Manager should not evolve into three separate systems.

The correct architecture is:
- **one backend / one source of truth**
- **operator full app**
- **tenant free companion app**
- **vendor free companion app**
- **operator-first Outlook / Microsoft 365 integration**

If we split this into disconnected products, we create duplicated auth, duplicated request state, notification drift, and support pain. That is fake complexity.

---

## Product packaging

### 1. Full app: Property Manager / Operator
Paid product.

Primary capabilities:
- portfolio setup
- property/unit management
- maintenance intake and triage
- dispatch and vendor routing
- tenant communication
- vendor management
- reporting/history
- settings/integrations/billing
- Outlook / Microsoft 365 integration

### 2. Free companion app: Tenant
Free role-scoped surface.

Primary capabilities:
- sign in / invite access
- submit maintenance request
- upload photos
- view request status and timeline
- receive updates
- message where allowed

### 3. Free companion app: Vendor
Free role-scoped surface.

Primary capabilities:
- sign in / invite access
- see assigned work
- accept / decline
- schedule / planned start / ETA updates
- upload notes/photos/bids where allowed
- close out work

---

## Architecture principles

### One backend, role-scoped clients
Keep:
- one identity system
- one request/event timeline
- one vendor/tenant/operator data model
- one notification system
- one media/storage model

Different apps should be mostly **different shells over the same platform**.

### Web-first before native theater
Fastest sane route:
1. responsive web app / PWA base
2. installable role-specific shells if needed
3. native wrappers only if the market proves they matter

Do not start by building three native stacks.

### Integration layering
Order matters:
1. core workflow truth
2. role-specific app shells
3. mailbox integration
4. advanced automation / triage intelligence

---

## Outlook / Microsoft 365 integration roadmap

## Goal
Allow the property manager/operator to connect Outlook/Microsoft 365 so email can become part of the maintenance workflow without turning PM into a general-purpose mail client.

## Phase O1 — outbound email truth
Objective: clean delivery first, before sync fantasy.

Deliver:
- reliable outbound email infrastructure
- branded email templates
- delivery logging/status visibility
- per-event email preferences
- message records tied to PM entities

Why first:
If outbound email is weak, Outlook sync is lipstick on a broken notification layer.

## Phase O2 — Microsoft account connect
Objective: connect operator mailbox securely.

Deliver:
- Microsoft OAuth for operator accounts
- store tenant-safe token metadata and encrypted refresh tokens
- integration settings UI
- mailbox connection status / disconnect flow

Scope:
- operator/full-app only
- no tenant/vendor mailbox sync

## Phase O3 — maintenance email ingest
Objective: pull relevant email into PM.

Deliver:
- inbox sync for selected folders/mailboxes
- rule/filter layer for maintenance-related mail
- create inbox items inside PM from synced messages
- manual promote-to-request action
- link email thread to property / tenant / request when obvious

Keep it narrow:
- do not claim perfect email understanding
- start with assisted triage, not magical auto-routing

## Phase O4 — request creation from email
Objective: turn email into actionable maintenance items.

Deliver:
- create request from email thread
- attach email body/metadata into request timeline
- assign property/unit/tenant manually when uncertain
- dedupe guardrails to prevent duplicate requests

## Phase O5 — two-way operator workflow
Objective: reply from PM with mailbox continuity.

Deliver:
- send outbound operator messages via connected mailbox
- preserve subject/thread identity where possible
- log sent/received message history on the request

Caution:
This is where integration complexity rises. Only do this after O1-O4 work is stable.

---

## App roadmap

## Phase A1 — single codebase, role-hard surfaces
Objective: strengthen what already exists.

Deliver:
- operator full web app remains primary control surface
- tenant and vendor role surfaces continue to harden under shared backend
- improve auth/session boundaries and invite flows
- improve media and notification reliability

Exit criteria:
- one backend behaves correctly for all three roles
- shared data/state is trustworthy

## Phase A2 — free companion app framing
Objective: turn tenant/vendor role surfaces into explicit free companion apps.

Deliver:
- role-branded navigation and onboarding
- clearer app-store / installable positioning
- invite-driven install/access flow
- polished mobile-first UX for tenant/vendor

Practical truth:
This can still be one deployed app with role-based surfaces at first.

## Phase A3 — installable app shells
Objective: make companion experiences feel like real apps.

Deliver:
- PWA installability
- push-notification groundwork
- offline-light caching where useful
- home-screen install flow

## Phase A4 — native packaging only if justified
Objective: go native only when benefits are real.

Possible triggers:
- push delivery requirements
- camera/file-upload UX limits in web shell
- app-store distribution advantage
- mobile retention materially improves with native packaging

Until then, avoid multi-platform ceremony.

---

## Suggested implementation sequence

## Track 1 — stabilize PM core
1. keep operator/tenant/vendor workflow reliable
2. finish hosted bring-up
3. prove end-to-end production smoke flow
4. keep auth/media/notification truth high

## Track 2 — role-scoped app packaging
5. formalize operator full app vs tenant/vendor free companion positioning
6. polish tenant/vendor mobile UX
7. make companion surfaces installable/PWA-ready

## Track 3 — Outlook integration
8. finish outbound email infrastructure and visibility
9. add Microsoft OAuth connection
10. add maintenance email ingest inbox
11. add email-to-request conversion
12. later add operator reply/thread sync if justified

---

## Concrete backlog items

### Operator full app
- integration settings page
- Microsoft 365 connect/disconnect flow
- email delivery status/audit panel
- inbox triage panel for synced mail
- email-to-request conversion flow

### Tenant free app
- stronger mobile request creation
- photo upload reliability
- clearer request timeline and updates
- installable app shell / PWA polish

### Vendor free app
- assignment inbox
- accept/decline workflow
- ETA/planned start updates
- quote/bid upload where allowed
- installable app shell / PWA polish

### Shared backend
- unified notifications/events model
- message threading model
- integration token storage/security
- role-scoped push/email preferences
- audit logging for mailbox-linked actions

---

## Risks

### Risk 1: fake multi-app architecture
Building three disconnected codebases too early.

Mitigation:
- keep one backend
- keep shared models
- prefer one web platform with role shells first

### Risk 2: Outlook sync scope explosion
Mailbox integration can eat the roadmap.

Mitigation:
- operator-only first
- ingest/triage before reply/send complexity
- no full mail client ambitions in v1

### Risk 3: confusing free vs paid boundaries
If tenant/vendor apps feel monetized or restricted wrong, the model gets muddy.

Mitigation:
- operator is the paying customer
- tenant/vendor are companion participants
- free apps should improve workflow participation, not become separate products

---

## Recommended next execution move

The next sane move is **not** immediate Outlook coding.

It is:
1. keep PM core stable
2. record this platform direction in Mission Control
3. treat **operator full app + free companion app architecture** as a roadmap layer
4. treat **Outlook integration** as a staged operator-side integration program beginning with outbound email truth and Microsoft account connect

That is the simplest real system that can work.
