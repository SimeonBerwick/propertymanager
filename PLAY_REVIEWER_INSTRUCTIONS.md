# Google Play Reviewer Login Instructions

The Android review accounts are stable fixtures and must remain active while a release is under review.

## Property manager

1. Open the app and select property-manager sign in.
2. Enter the configured `ANDROID_REVIEWER_LANDLORD_EMAIL`.
3. Enter the password supplied in the Play Console review-access field.

The property-manager account has an active non-expiring subscription and sample property, unit, tenant, vendor, and request data.

## Tenant

1. Open tenant access and choose returning tenant sign in.
2. Enter the configured `ANDROID_REVIEWER_TENANT_EMAIL`.
3. If the app asks for a verification code after email entry, enter the six-digit code supplied in the Play Console review-access field.

The tenant has an open-ended active lease and sample maintenance requests.

## Vendor

1. Open vendor access and choose vendor sign in.
2. Enter the configured `ANDROID_REVIEWER_VENDOR_EMAIL`.
3. If the app asks for a verification code after email entry, enter the same six-digit code supplied in the Play Console review-access field.

The vendor is active and has a scheduled sample assignment. If the sample has already been completed during testing, it remains visible under recent work.

## Operations

- Runtime access is enabled only when `ANDROID_REVIEWER_ACCESS_ENABLED=true`.
- The fixed OTP applies only to the exact configured tenant and vendor reviewer emails.
- Run `npm run seed:android-reviewers` from `apps/web` after setting `DATABASE_URL` and `ANDROID_REVIEWER_LANDLORD_PASSWORD`.
- Do not commit reviewer passwords or OTP codes.
