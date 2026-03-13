# Property Manager V1 - Invite System Build Plan

## Purpose
This document turns the onboarding/invite spec into an implementation-ready build plan.

It is for building the first real invite-controlled onboarding path where:
- operator is the paying account owner
- tenant access is free
- vendor access is free
- tenant/vendor users join the operator-owned workspace via operator-generated invite links or access codes

This build plan focuses on the first useful, trustworthy slice — not the fully polished forever version.

---

## 1. Build goal

### Goal
Ship a pilot-ready invite system that lets:
- an operator invite a tenant into the correct property/unit context
- an operator invite a vendor into the correct organization/vendor context
- a tenant or vendor accept that invite safely and land in the right surface
- the system enforce scope so invites cannot be used to cross org boundaries

### Non-goals for first slice
- self-serve public signup for tenants/vendors
- operator-team invites / staff seat management
- advanced analytics on invite conversion
- multi-org membership
- magic-link passwordless auth
- deeply polished billing-aware operator signup

---

## 2. Recommended implementation sequence

### Slice A - Data model + token foundation
Build the trust boundary first.

### Slice B - Operator invite creation
Let operators generate tenant and vendor invites from the relevant workflows.

### Slice C - Invite acceptance flow
Let tenants/vendors accept valid invites and create credentials.

### Slice D - Invite management + revocation
Let operators inspect, revoke, and regenerate invites.

### Slice E - QA + abuse-case hardening
Prove the thing is not trivially leaky or brittle.

---

## 3. Schema changes

## New enums
### InviteType
- TENANT
- VENDOR
- later: OPERATOR_TEAM if needed, but not now

### InviteStatus
- ACTIVE
- USED
- EXPIRED
- REVOKED

## New model: Invite
Suggested fields:
- `id`
- `type`
- `organizationId`
- `propertyId` nullable
- `unitId` nullable
- `tenantId` nullable
- `vendorId` nullable
- `email` nullable
- `tokenHash`
- `displayCodeHash` nullable
- `status`
- `expiresAt`
- `usedAt` nullable
- `revokedAt` nullable
- `createdAt`
- `createdByUserId`

### Relations
- belongs to `Organization`
- optionally belongs to `Property`
- optionally belongs to `Unit`
- optionally belongs to `Tenant`
- optionally belongs to `Vendor`
- belongs to creating `AppUser`

## Optional future model: InviteAuditEvent
Not required for first slice if `Invite` plus request/activity history is enough.
But worth considering later if invite lifecycle becomes operationally important.

---

## 4. Secret/token handling

## Default approach
- generate a long random invite token
- store only a hash in the database
- send raw token only in the invite link/code shown at creation time

## Invite link format
Example:
- `/join?token=<raw-token>`

## Access code fallback
For V1, access code can be derived as a shorter operator-shareable fallback, but if that adds too much complexity, defer it.

### Recommendation
For first implementation slice:
- build **invite links first**
- defer human-friendly access codes unless it is very cheap to add

That keeps the first build smaller and more secure.

---

## 5. Operator-facing routes and actions

## Operator invite creation surfaces
### Tenant invite
Recommended surfaces:
- unit detail page
- tenant detail/edit page
- request detail page if tenant context already exists

### Vendor invite
Recommended surfaces:
- vendor detail page
- vendor list/detail workflow
- request dispatch view if vendor context already exists

## Operator actions needed
- `createTenantInvite`
- `createVendorInvite`
- `revokeInvite`
- `regenerateInvite` (can be create new + revoke old)

## Server-side rules
- operator must belong to the invite's organization
- tenant invite must only target units/properties/tenant records inside operator org
- vendor invite must only target vendor records inside operator org
- foreign-org raw IDs must fail closed

---

## 6. Join/acceptance routes

## Recommended routes
- `/join` - generic invite acceptance entry point
- `/join/tenant` optional specialized route later
- `/join/vendor` optional specialized route later

### First-slice recommendation
Use one generic `/join` route that resolves token -> invite type -> correct acceptance UI.

## Acceptance flow
### Tenant
1. open valid invite link
2. validate token
3. show tenant-friendly acceptance screen with enough context
   - organization name
   - property/unit label if appropriate
4. collect/confirm name, email if needed, password
5. attach or activate the correct tenant record
6. sign in tenant
7. redirect to tenant request/status surface

### Vendor
1. open valid invite link
2. validate token
3. show vendor-friendly acceptance screen with org/vendor context
4. collect/confirm account details and password
5. attach or activate correct vendor record
6. sign in vendor
7. redirect to vendor queue

---

## 7. Entity attachment strategy

## Tenant attachment
Best first-slice pattern:
- operator already creates the tenant record
- invite attaches to that specific tenant record or unit context
- acceptance activates credentialed access on that record

Why:
- cleaner scoping
- fewer duplicate-record risks
- easier operator control

## Vendor attachment
Best first-slice pattern:
- operator already creates vendor record
- invite attaches to that vendor record
- acceptance adds credentials for that vendor record

Why:
- preserves operator-controlled vendor roster
- avoids free-floating vendor signup

---

## 8. UX requirements by slice

## Slice A - foundations
- no user-facing polish required beyond correctness
- must fail cleanly for invalid data/model states

## Slice B - operator create invite UX
- one obvious button/action
- copyable invite link
- clear expiry note
- visible status of active invites

## Slice C - invite acceptance UX
- mobile-friendly
- minimal steps
- plain language
- clear expired/revoked/invalid handling

## Slice D - invite management UX
- operator can see:
  - active
  - used
  - expired
  - revoked
- operator can revoke/reissue without weird side effects

---

## 9. Suggested tickets

## PM-013 - Add invite schema and token utilities
### Tasks
- add Invite enums/model
- add Prisma migration/schema updates
- add token generation + hashing helpers
- add invite validation helpers

### Acceptance criteria
- system can create hashed invite records
- raw token is never required to persist in DB
- invite status/expiry can be evaluated reliably

## PM-014 - Build operator tenant-invite creation flow
### Tasks
- add operator action to create tenant invite
- scope invite to operator org + unit/property/tenant context
- display/copy invite link

### Acceptance criteria
- operator can create tenant invite only for own-org records
- created invite link resolves to a valid join path

## PM-015 - Build operator vendor-invite creation flow
### Tasks
- add operator action to create vendor invite
- scope invite to operator org + vendor context
- display/copy invite link

### Acceptance criteria
- operator can create vendor invite only for own-org vendor records
- created invite link resolves to a valid join path

## PM-016 - Build generic join route and acceptance UX
### Tasks
- add `/join` route
- validate token
- route to tenant/vendor acceptance form state
- handle invalid/expired/revoked/used cases cleanly

### Acceptance criteria
- valid invite loads correct acceptance experience
- invalid invites fail cleanly with no leakage

## PM-017 - Tenant invite acceptance implementation
### Tasks
- accept tenant invite
- set password / account access on targeted tenant record
- sign tenant in
- redirect to tenant surface

### Acceptance criteria
- accepted tenant lands in correct unit-scoped context
- tenant cannot use invite to reach foreign data

## PM-018 - Vendor invite acceptance implementation
### Tasks
- accept vendor invite
- set password / account access on targeted vendor record
- sign vendor in
- redirect to vendor queue

### Acceptance criteria
- accepted vendor lands in correct org/vendor context
- vendor cannot use invite to reach foreign data

## PM-019 - Invite management and revocation
### Tasks
- show invite status list on relevant operator pages
- revoke invite
- regenerate invite cleanly

### Acceptance criteria
- revoked invite no longer works
- replaced invite behavior is predictable and safe

## PM-020 - Invite-system QA and abuse-case tests
### Tasks
- automated tests for invite validation and org scoping
- invalid/expired/revoked invite tests
- foreign-org invite misuse tests
- reused invite tests if single-use

### Acceptance criteria
- obvious invite abuse paths are covered by regression tests
- acceptance flow does not create cross-org or cross-record leakage

---

## 10. Route/action ideas

### Operator side
- `/operator/units/[id]` -> create tenant invite action
- `/operator/vendors/[id]` -> create vendor invite action
- `/operator/invites` optional later, if central invite management becomes useful

### Public/shared side
- `/join?token=...`

### Supporting server helpers
- `lib/invites.ts`
- `lib/invite-scope.ts`
- `lib/token.ts` or similar

---

## 11. QA scenarios

### Happy paths
- operator creates tenant invite -> tenant accepts -> lands in tenant flow
- operator creates vendor invite -> vendor accepts -> lands in vendor queue

### Failure paths
- expired invite
- revoked invite
- malformed token
- reused invite
- foreign-org operator trying to generate invite for wrong record
- invite token for tenant trying to behave like vendor flow

### Abuse cases
- manually modified join token
- invite for unit A attempting to expose unit B data
- vendor invite attached to one org attempting to read another org’s data
- revoked invite still cached somewhere and retried

---

## 12. Build recommendation

### Best first slice to ship
1. invite schema + token utilities
2. tenant invite create + accept
3. vendor invite create + accept
4. revoke flow
5. automated tests

Reason:
- this gets the core rollout model real quickly
- tenant/vendor onboarding becomes practical
- trust boundary gets exercised early

---

## 13. Definition of done for first invite-system milestone

- [ ] operator can create tenant invite from own-org context
- [ ] operator can create vendor invite from own-org context
- [ ] tenant can accept valid tenant invite and sign in
- [ ] vendor can accept valid vendor invite and sign in
- [ ] invalid/expired/revoked invites fail cleanly
- [ ] foreign-org invite misuse is blocked
- [ ] regression tests cover the main abuse cases
- [ ] joined users land in the correct role surface

---

## 14. Recommended next executor

Bob should implement this in the order above.
Jeff should review invite acceptance failures, scope enforcement, and whether the UX is clear enough that invited users do not get confused on first contact.
