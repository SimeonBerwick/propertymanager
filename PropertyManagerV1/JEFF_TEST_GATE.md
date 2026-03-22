# Jeff Test Gate

## Goal of first finished build
Jeff should be able to:
1. log in as landlord
2. create a property and unit
3. submit a maintenance request
4. attach a photo
5. see the request in the dashboard inbox
6. change its status
7. assign a vendor
8. add a comment/update
9. review issue history on the unit/property

## Pass criteria
- request submission works cleanly
- dashboard inbox is understandable
- status flow is clear
- request detail page contains the needed context
- photo handling works
- basic history/reporting is usable without explanation

## Fail criteria
- requests get lost or duplicated
- status transitions are confusing
- property/unit linkage is unclear
- comments/updates are hard to follow
- landlord cannot manage the workflow from one place

---

## QA Checklist — Walk-through Script

Work through each step in order. A ✓ means the step passes; note any failure inline.

### 1. Auth
- [ ] Navigate to `/` → redirected to `/login`
- [ ] Submit empty form → shows validation error
- [ ] Submit wrong password → shows "Invalid email or password"
- [ ] Submit correct credentials → redirected to `/dashboard`
- [ ] Nav shows: Dashboard · Properties · Reports · Sign out
- [ ] Sign out → redirected to `/login`, nav hidden
- [ ] Re-login successfully

### 2. Dashboard
- [ ] Stat cards show correct counts (New / Scheduled / In Progress / Done)
- [ ] Inbox table shows all 5 seed requests with correct status badges
- [ ] Request title links to `/requests/[id]`
- [ ] Property name links to `/properties/[id]`
- [ ] "Tenant issue form" button links to `/submit`

### 3. Tenant submission (`/submit` — no login required)
- [ ] Page loads without authentication
- [ ] Property dropdown populates
- [ ] Selecting a property filters the unit dropdown
- [ ] All required fields enforce validation (submit empty → error)
- [ ] Overlong title (>200 chars) → server error
- [ ] Attach a valid image → accepted
- [ ] Submit valid form → confirmation screen shows Reference ID
- [ ] New request appears in dashboard inbox after submission

### 4. Request detail
- [ ] Open a request → detail page loads with title, property/unit links, status, urgency, category
- [ ] Property name links back to property detail
- [ ] Unit label links to unit history
- [ ] Photos section shows uploaded photos or "No photos uploaded"
- [ ] Timeline section shows status events with readable labels (e.g. "New → Scheduled")
- [ ] Comments section shows existing comments with "Internal note" / "Tenant-facing" badge

### 5. Status transitions
- [ ] Status dropdown shows all statuses except current
- [ ] Click "Update status" → status badge updates immediately (revalidation)
- [ ] Timeline appends the new transition event
- [ ] Trying to set same status as current → error message

### 6. Vendor assignment
- [ ] Type a vendor name → click "Save vendor" → vendor shown in detail card
- [ ] Clear vendor name → click "Save vendor" → shows "Unassigned"
- [ ] Vendor name over 120 chars → error message

### 7. Comments
- [ ] Submit comment → appears in list without page reload
- [ ] Textarea clears after successful submit
- [ ] "Internal note" visibility → blue badge on comment
- [ ] "Tenant-facing" visibility → green badge on comment
- [ ] Empty body → error "Comment body is required"
- [ ] Body over 2000 chars → error message

### 8. Properties view
- [ ] `/properties` lists both seed properties with their units
- [ ] Unit names link to `/units/[id]`
- [ ] Property name links to property detail

### 9. Property detail
- [ ] Stat cards: Total / Open / Closed counts are correct
- [ ] Units list shows occupancy with links to unit history
- [ ] History shows all requests for that property with status badges

### 10. Unit history
- [ ] Unit header shows tenant name + email (or "Vacant")
- [ ] Stat cards: Total / Open / Closed correct
- [ ] Request history table shows all requests for unit
- [ ] Open requests show age badge (green/amber/red based on days)
- [ ] Done requests show "—" in age column

### 11. Reports
- [ ] Summary stat row: Total / Open / Closed counts match dashboard
- [ ] By-property table shows both properties with correct counts
- [ ] Aging view lists all open requests sorted by age (oldest first)
- [ ] Age badges: green <7d, amber 7–14d, red ≥14d
- [ ] Repeat issue section: Unit A (Canyon View) shows 2 Plumbing requests
- [ ] All table rows link to the correct detail pages

### 12. Edge cases
- [ ] Navigate to `/requests/nonexistent` → 404 not-found page
- [ ] Navigate to `/properties/nonexistent` → 404 not-found page
- [ ] Navigate to `/units/nonexistent` → 404 not-found page
