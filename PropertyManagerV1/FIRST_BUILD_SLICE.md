# First Build Slice

## Status
Complete.

## What this slice needed to prove
Reach a usable internal build fast enough for Jeff to test the real maintenance workflow.

## What is now true
1. Web app scaffold exists
2. Landlord auth shell exists
3. Property and unit creation exist in-app
4. Maintenance request schema and flows exist
5. Landlord dashboard inbox is live
6. Request detail page supports status, vendor, and comments
7. Tenant issue submission exists
8. Photo upload exists and is privately served
9. Property and unit history views exist
10. DB-backed workflow integration test exists
11. Playwright browser harness exists

## Gate result
The product core is proven at the app level. Jeff gate logic is now a verification/runtime problem, not a missing-feature problem.

## Actual next slice
1. Run the browser workflow in CI/container consistently
2. Harden deployment/runtime infrastructure
3. Improve vendor recommendation and SLA policy

## Why this order
The first thing to prove was that a landlord can actually operate from one maintenance inbox. That proof now exists. The next leverage is turning it into repeatable browser validation and cleaner production infrastructure.
