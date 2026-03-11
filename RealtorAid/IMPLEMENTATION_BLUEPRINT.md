# Implementation Blueprint

## Recommended repository structure
- `apps/web` - Next.js app
- `packages/ui` - shared UI components if needed later
- `packages/config` - shared TS config/eslint if monorepo
- `workers/generation` - background generation worker
- `infra` - deployment/config notes

## Suggested MVP pages
- `/login`
- `/dashboard`
- `/projects/[id]`
- `/projects/[id]/upload`
- `/jobs/[id]`
- `/results/[id]`

## Suggested DB tables
### users
- id
- email
- role
- created_at

### projects
- id
- user_id
- title
- created_at

### photos
- id
- project_id
- original_url
- room_type
- upload_status
- created_at

### generation_jobs
- id
- photo_id
- style_preset
- status
- model_provider
- prompt_version
- created_at
- completed_at
- error_message

### generation_variants
- id
- generation_job_id
- image_url
- is_selected
- score optional
- created_at

## First API endpoints
- `POST /api/photos/upload`
- `POST /api/jobs`
- `GET /api/jobs/:id`
- `GET /api/results/:jobId`

## First internal statuses
- uploaded
- queued
- processing
- completed
- failed

## Execution principle
Do not start by optimizing the model.
Start by making the workflow reliable from upload -> queued -> processed -> reviewed.
