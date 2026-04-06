# Jeff QA - Billing Slice

Date: 2026-04-06
App: `PropertyManagerV1/apps/web`
Scope: Request detail billing pass

## Goal
Verify that the billing surface on request detail is now shippable:
- summary cards are correct
- create/send and draft flows work
- resend / duplicate / void actions behave correctly
- billing history is understandable
- no obvious operator traps exist

## Setup
1. Start the PM app
2. Log in as landlord/operator
3. Open a maintenance request with:
   - tenant email present
   - ideally an assigned vendor email too
4. If needed, assign a vendor first so both tenant and vendor billing paths can be exercised

## QA checklist

### A. Billing section renders correctly
- Open request detail
- Confirm billing section shows:
  - billing summary cards
  - billing document form
  - billing document list
  - billing activity trail
- Expected:
  - no layout break
  - no missing controls
  - no obvious duplicate UI blocks

### B. Summary cards with no docs
- Use a request with no billing documents yet
- Expected:
  - totals show zero cleanly
  - no crash
  - wording still makes sense

### C. Create tenant invoice and send
- In billing form select `Tenant damage chargeback`
- Verify preset auto-fills:
  - recipient type = tenant
  - title updates
  - description updates
  - send-to defaults to tenant email if available
- Enter amount `250.00`
- Leave paid amount `0.00`
- Mode = `Create and send`
- Submit
- Expected:
  - new billing doc appears
  - status is `sent`
  - activity trail shows created/sent event
  - summary cards update

### D. Create vendor remittance preset
- Select `Vendor partial payment` preset
- Verify preset auto-fills:
  - recipient type = vendor
  - title updates
  - description updates
  - send-to defaults to vendor email if available
- Enter amount `400.00`
- Enter paid amount `150.00`
- Mode = `Create and send`
- Submit
- Expected:
  - new document appears
  - status is `partial`
  - summary cards reflect cumulative billed / paid / open balance

### E. Draft flow
- Create another billing document with mode = `Create draft only`
- Expected:
  - document appears as `draft`
  - no send target required
  - event trail shows draft creation

### F. Resend action
- On a sent document with `sentTo` populated, click `Resend`
- Expected:
  - no crash
  - activity trail shows resend event
  - sent timestamp updates logically
- Negative check:
  - on a draft with no recipient, resend should show a clear error
  - on a void doc, resend should be blocked

### G. Duplicate action
- Duplicate a sent or partial billing doc
- Expected:
  - a new copy appears
  - copied title is clearly marked as copy
  - copied amounts are preserved
  - event trail on new doc indicates duplication
- Callout:
  - note whether this behavior feels right operationally, especially if duplicate preserves sent target/state

### H. Void action
- Void a non-void document
- Expected:
  - status changes to `void`
  - activity trail records void action
  - resend is blocked afterward
- Important observation:
  - check whether summary cards should include void docs or exclude them
  - record if current behavior feels wrong for accounting/operator expectations

### I. Payment status update still works
- Use payment status update control on a sent document
- Set paid amount to a partial value, then full value
- Expected:
  - status moves `sent` -> `partial` -> `paid`
  - paid/balance values update correctly
  - summary cards stay consistent

### J. Edge cases
- Try paid amount greater than total
- Expected: clear validation error
- Try invalid amount input
- Expected: clear validation error
- Try actions across multiple docs on same request
- Expected: list and activity trail stay coherent

## Specific things Jeff should call out
1. Does duplicate behavior match operator expectations, or should duplicate create a draft instead?
2. Should voided documents count in summary cards, or should they be excluded?
3. Are the event labels understandable to a real landlord/operator?
4. Any action that feels risky because buttons are too easy to click or insufficiently explained
5. Any copy that sounds like dev language instead of operator language

## Ship standard
This slice is good to ship if:
- all core flows work without errors
- summary math is coherent
- resend / duplicate / void behave predictably
- no obvious UI confusion blocks operator use

If any of those fail, do not expand scope. Fix the specific failure and rerun this QA.