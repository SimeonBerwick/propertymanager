# Property Manager V1 - Jeff QA Checklist

## Purpose
This checklist defines Jeff’s review gate for the next Property Manager V1 sprint.

Review goal: verify the app is ready to move from local-demo quality to controlled private-beta quality.

---

## 1. Auth and access control

### Checkpoints
- [ ] Login works for operator, tenant, and vendor test accounts
- [ ] Logout works cleanly
- [ ] Protected routes reject unauthenticated users
- [ ] Expired/invalid sessions are handled cleanly
- [ ] No protected dashboard is reachable without authentication

### Pass criteria
- Auth works consistently
- No obvious bypass to protected pages
- Session failure states do not create broken or confusing UX

---

## 2. Role boundaries

### Operator
- [ ] Operator can access operator dashboard and request management surfaces
- [ ] Operator can assign vendors
- [ ] Operator can update request statuses where intended
- [ ] Operator can view internal notes

### Tenant
- [ ] Tenant can submit a request
- [ ] Tenant can view only their own requests
- [ ] Tenant cannot access operator routes
- [ ] Tenant cannot access vendor routes
- [ ] Tenant cannot see internal notes

### Vendor
- [ ] Vendor can access vendor queue/detail surfaces
- [ ] Vendor can view only assigned work
- [ ] Vendor can update assigned job progress where intended
- [ ] Vendor cannot access operator-only functions
- [ ] Vendor cannot access tenant-only views beyond intended surfaces

### Pass criteria
- Route-level and action-level permissions are both enforced
- No cross-role leakage is observed in normal use or direct-link tests

---

## 3. Data isolation and leakage checks

### Checkpoints
- [ ] Tenant A cannot access Tenant B requests by direct URL or manipulated request
- [ ] Vendor cannot access unassigned jobs by direct URL or manipulated request
- [ ] Unauthorized records are not returned in list views
- [ ] Internal notes are never visible on tenant-facing screens
- [ ] Sensitive actions fail safely when attempted without permission

### Pass criteria
- No obvious cross-account or cross-role data leakage
- Unauthorized data access attempts are blocked cleanly

---

## 4. End-to-end lifecycle smoke test

### Scenario
Run one request through the full intended flow:
1. Tenant submits request with photo
2. Operator reviews request
3. Operator assigns vendor
4. Vendor updates progress/status
5. Tenant sees progress reflected clearly

### Checkpoints
- [ ] Submission succeeds
- [ ] Photo attachment appears correctly
- [ ] Operator sees request in intake/inbox
- [ ] Vendor assignment succeeds
- [ ] Vendor sees assigned work correctly
- [ ] Vendor updates are saved and visible where expected
- [ ] Tenant sees request progress/status updates
- [ ] Timeline/history reflects the flow coherently

### Pass criteria
- Full lifecycle works end-to-end without confusion or manual cleanup

---

## 5. Status model consistency

### Checkpoints
- [ ] Same canonical statuses appear across operator, tenant, and vendor views where appropriate
- [ ] Invalid status transitions are blocked
- [ ] Timeline/history reflects real state changes accurately
- [ ] Status wording is understandable to each user role

### Pass criteria
- State model is consistent and legible across the app

---

## 6. Workflow quality

### Operator flow
- [ ] Inbox is easy to scan
- [ ] Priority/category/status are visible enough for triage
- [ ] Common actions are easy to find
- [ ] Request detail layout supports quick decisions

### Vendor flow
- [ ] Queue is easy to scan
- [ ] Job detail clearly shows what to do next
- [ ] Status updates are straightforward

### Tenant flow
- [ ] Submission form is understandable
- [ ] Confirmation state is reassuring
- [ ] Status/progress view is clear and useful

### Pass criteria
- Main happy-path workflows feel coherent and require little explanation

---

## 7. Reliability and UX states

### Checkpoints
- [ ] Form validation catches obvious bad inputs
- [ ] Error states are understandable
- [ ] Loading states are present and not misleading
- [ ] Empty states are clear and reasonable
- [ ] App does not feel brittle during normal use

### Pass criteria
- No obvious trust-breaking UX failures in normal interactions

---

## 8. Mobile tenant check

### Checkpoints
- [ ] Tenant request submission works on mobile-width screens
- [ ] Photo upload works on mobile-width screens
- [ ] Tenant status/progress screens are readable on mobile-width screens
- [ ] No major layout breakage on tenant-critical paths

### Pass criteria
- Tenant-facing mobile experience is good enough for private beta

---

## 9. Audit/history visibility

### Checkpoints
- [ ] Key actions generate visible timeline/activity entries
- [ ] Request changes are traceable enough for debugging and review
- [ ] Dispatch/assignment events are recorded clearly

### Pass criteria
- Operators can understand what happened to a request without guessing

---

## 10. Release recommendation

### Final verdict
- [ ] PASS - Ready for controlled private beta
- [ ] PASS WITH CONDITIONS - Usable, but specific non-blocking issues remain
- [ ] FAIL - Not ready; blocking issues must be fixed first

### Blocking issues
- [ ] None
- [ ] Document blockers here during review

### Notes
- Add concise QA notes, edge cases, and recommendations here.

---

## Jeff sign-off standard
Jeff should approve only if:
- role boundaries are real
- end-to-end flow works cleanly
- tenant-facing experience feels trustworthy
- no obvious security or trust-breaking bugs appear during normal use
- the app can be shown privately without apology-led narration
