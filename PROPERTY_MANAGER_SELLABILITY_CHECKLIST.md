# Property Manager V1 - Sellability Checklist

## Purpose
This checklist bridges the gap between:
- controlled private beta candidate
- pilot-ready
- paid beta-ready
- publicly sellable

It is intentionally blunt. The goal is not to feel good about progress. The goal is to know what must be true before taking real customer money with a straight face.

---

## Current status
Property Manager V1 is currently best described as:
- **controlled private beta candidate**

That means:
- the core multi-role workflow is materially real
- auth/authz boundaries are good enough for controlled exposure
- it is **not** yet ready for general sale

---

## Stage 1 - Pilot-ready

### Goal
Safe enough to use with a small number of friendly real users.

### Product and workflow
- [ ] Operator can manage real properties and units without demo-only assumptions
- [ ] Tenant can submit maintenance requests cleanly on mobile
- [ ] Vendor can receive and update assigned work cleanly
- [ ] Request lifecycle works end-to-end without manual cleanup
- [ ] Core reporting is useful enough for a small landlord

### Infrastructure
- [ ] Replace local SQLite with PostgreSQL
- [ ] Choose deployment path for app and database
- [ ] Configure production environment variables cleanly
- [ ] Add backups for production data
- [ ] Add basic uptime/error monitoring

### Files and attachments
- [ ] Replace placeholder/local assumptions with real object storage for photos
- [ ] Ensure attachment access rules follow role permissions
- [ ] Verify uploads/downloads work reliably in deployed environment

### Security and auth
- [ ] Require real `AUTH_SECRET` in deployed environments
- [ ] Remove normalization of demo/fallback secret behavior for real environments
- [ ] Tighten operator org/property scoping beyond single-org demo assumptions
- [ ] Extend auth/authz regression coverage for more abuse cases
- [ ] Add basic audit visibility for sensitive actions

### QA
- [ ] Run full tenant -> operator -> vendor -> tenant lifecycle in deployed environment
- [ ] Validate mobile tenant experience end to end
- [ ] Validate attachment flow in deployed environment
- [ ] Validate no obvious cross-account leakage in happy path and direct-link path

### Pilot-ready exit test
- [ ] One real landlord can use it across 1-5 properties without trust-breaking bugs
- [ ] Tenant and vendor can participate without setup confusion
- [ ] App survives normal use without apology-driven babysitting

---

## Stage 2 - Paid beta-ready

### Goal
Good enough to charge a small number of early customers.

### Customer onboarding
- [ ] Create landlord account onboarding flow
- [ ] Create user invite flow for operator/team access if needed
- [ ] Add password reset flow
- [ ] Add cleaner account/session management UX

### Commercial readiness
- [ ] Define pricing model
- [ ] Implement billing/subscription system
- [ ] Define trial / refund / cancellation rules
- [ ] Add terms of service
- [ ] Add privacy policy

### Reliability and support
- [ ] Add browser-based end-to-end tests for critical flows
- [ ] Add support/recovery workflow for account problems
- [ ] Improve operational logging for debugging customer issues
- [ ] Improve error handling on key user journeys
- [ ] Prepare admin/support runbook for common failures

### Product polish
- [ ] Improve operator triage speed and clarity
- [ ] Improve vendor workflow quality
- [ ] Improve tenant progress visibility and reassurance
- [ ] Improve reporting enough to support weekly use

### Paid beta-ready exit test
- [ ] A new customer can onboard without your direct intervention
- [ ] Billing works reliably
- [ ] Common support issues have a defined recovery path
- [ ] Product feels trustworthy enough that charging does not feel dishonest

---

## Stage 3 - Publicly sellable

### Goal
Ready for wider marketing and normal customer acquisition.

### Product and market readiness
- [ ] Positioning is clear and differentiated
- [ ] Landing page explains who it is for and why it matters
- [ ] Pricing is simple and defensible
- [ ] Onboarding funnel is smooth enough to convert strangers

### Operational maturity
- [ ] Backup/restore confidence is proven
- [ ] Monitoring/alerts are sufficient for ongoing operations
- [ ] Security review is materially stronger
- [ ] Audit/history trail is robust enough for support and trust
- [ ] Admin controls are sufficient for customer management

### Product depth
- [ ] Reporting is good enough to retain paying users
- [ ] Vendor workflow is mature enough for repeated weekly use
- [ ] Operator workflow feels fast, obvious, and dependable
- [ ] Tenant experience feels clean enough not to damage trust in the landlord

### Go-to-market basics
- [ ] Basic analytics/conversion tracking is in place
- [ ] Demo environment is stable
- [ ] Sales/support docs exist
- [ ] Core objections and limitations are documented honestly

### Publicly sellable exit test
- [ ] You can send cold traffic to it without embarrassment
- [ ] You can take payment confidently
- [ ] You can recover from normal failure modes without chaos

---

## Highest-leverage next moves

### Immediate priorities
1. [ ] PostgreSQL migration and real deployment path
2. [ ] Real object storage for photos/attachments
3. [ ] Tighter operator org/property scoping
4. [ ] Onboarding + password reset
5. [ ] Billing system

### Why these first
- Deployment + Postgres + storage make it usable outside the laptop
- Scoping and auth hardening make it trustworthy
- Onboarding and billing make it commercially real

---

## Current recommendation
Do **not** jump straight from controlled private beta candidate to public sale.

Use this sequence instead:
- [x] Controlled private beta candidate
- [ ] Pilot-ready
- [ ] Paid beta-ready
- [ ] Publicly sellable

That sequence is slower to brag about and much better for not embarrassing yourself.
