# Implementation Blueprint

## Recommended repository structure
- `apps/web` - Next.js app
- `packages/db` - Prisma schema and DB access
- `packages/ui` - shared UI components if needed later
- `infra` - deployment/config notes

## Suggested MVP pages
- `/login`
- `/dashboard`
- `/properties`
- `/properties/[id]`
- `/requests/[id]`
- `/submit/[propertyId]/[unitId]`
- `/reports`

## Suggested DB tables
### users
- id
- email
- role
- created_at

### properties
- id
- owner_id
- name
- address
- created_at

### units
- id
- property_id
- label
- tenant_name optional
- tenant_email optional
- created_at

### maintenance_requests
- id
- property_id
- unit_id
- submitted_by_user_id optional
- title
- description
- category
- urgency
- status
- assigned_vendor_name optional
- created_at
- updated_at
- closed_at optional

### maintenance_photos
- id
- request_id
- image_url
- created_at

### request_comments
- id
- request_id
- author_user_id optional
- body
- visibility
- created_at

### status_events
- id
- request_id
- from_status optional
- to_status
- actor_user_id optional
- created_at

## First API endpoints
- `POST /api/properties`
- `POST /api/units`
- `POST /api/requests`
- `PATCH /api/requests/:id/status`
- `POST /api/requests/:id/comments`
- `POST /api/requests/:id/photos`

## First internal statuses
- new
- scheduled
- in_progress
- done

## Execution principle
Keep the state model tight and the landlord inbox simple. Do not let V1 bloat into accounting, leasing, or full tenant management.
